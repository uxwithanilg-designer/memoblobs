// Slide Ship — Zib crash-landed! Slide the picture tiles back into place to rebuild the clay UFO,
// then watch it fly off. Unlimited levels: deeper scrambles, 3×3 → 4×4 → 5×5 boards, numbers fade
// away, Kranky bumps the ship and fuel limits on the hardest levels.
import { ArcadeGame, Bag, Recent, byDiff, clamp, ease, lerp, ramp, Rng, type GameMeta } from "../engine";
import { blob, clayFill, clayPanel, clayText, darken, eye, lighten, mouth, rgba, rr, shadow, star, type G } from "../paint";

interface Theme { sky: [string, string, string]; planet: string; ring: string; moon: string; ground: string; ufo: string; plant: string; lights: string[] }
const THEMES: Theme[] = [
  { sky: ["#120A33", "#3B1F6E", "#9B5DE5"], planet: "#FF8A3D", ring: "#FFD25A", moon: "#FFF1C9", ground: "#74C94E", ufo: "#7CC8FF", plant: "#FF6F91", lights: ["#FFD25A", "#FF6F91", "#7CF2C9"] },
  { sky: ["#071433", "#1E4C8A", "#5FC3F0"], planet: "#FF6F91", ring: "#FFF4E2", moon: "#FFE38A", ground: "#E3A563", ufo: "#FF8A3D", plant: "#9B5DE5", lights: ["#FFFFFF", "#FFD25A", "#7CF2C9"] },
  { sky: ["#1A0F3A", "#5B2A86", "#FF8FB1"], planet: "#7CF2C9", ring: "#9B5DE5", moon: "#FFF4E2", ground: "#FFD25A", ufo: "#2EC4B6", plant: "#E8504F", lights: ["#FF6F91", "#FFFFFF", "#FFD25A"] },
  { sky: ["#06122B", "#173B5C", "#2E86C8"], planet: "#FFD25A", ring: "#FF8A3D", moon: "#DCD6E6", ground: "#B7A2E8", ufo: "#E8504F", plant: "#7CF2C9", lights: ["#FFD25A", "#7CC8FF", "#FFFFFF"] },
  { sky: ["#20103A", "#4A1F5C", "#C2457A"], planet: "#8FE3C0", ring: "#FFFFFF", moon: "#FFD25A", ground: "#6F7FE8", ufo: "#FFD25A", plant: "#FF8A3D", lights: ["#FF6F91", "#7CF2C9", "#9B5DE5"] },
  { sky: ["#0E2230", "#1F5E5B", "#5FD3A8"], planet: "#FF8FB1", ring: "#FFD25A", moon: "#FFF4E2", ground: "#C98A4B", ufo: "#C9D3E6", plant: "#FFD25A", lights: ["#FF6F91", "#FFD25A", "#7CC8FF"] },
  { sky: ["#1B1440", "#3A2A63", "#7A5BD6"], planet: "#B7FF5A", ring: "#2EC4B6", moon: "#FFE38A", ground: "#FF8FB1", ufo: "#FF6F91", plant: "#74C94E", lights: ["#FFD25A", "#FFFFFF", "#7CF2C9"] },
  { sky: ["#2A0E1E", "#6B1F3A", "#FF8A3D"], planet: "#7CC8FF", ring: "#FFF4E2", moon: "#FFF1C9", ground: "#9B5DE5", ufo: "#74C94E", plant: "#FFD25A", lights: ["#FF6F91", "#FFD25A", "#FFFFFF"] },
];
const P = 900; // picture resolution
const KRANKY = "/brand/kranky.webp", KRANKY_LAUGH = "/brand/kranky-laugh.webp";
const ZIB_HAPPY = "/brand/chars/zib-happy.webp", ZIB_WOW = "/brand/chars/zib-wow.webp";

interface Tile { id: number; r: number; c: number; dr: number; dc: number; spd: number; wig: number }
type Phase = "intro" | "play" | "bump" | "solved" | "fly" | "out";
interface UfoPose { x: number; y: number; s: number; tilt: number }

// ---------------------------------------------------------------- picture painting (offscreen)
function drawUfo(g: G, x: number, y: number, s: number, th: Theme, o: { tilt?: number; blink?: number; zib?: HTMLImageElement; wave?: number; crashed?: boolean } = {}) {
  g.save(); g.translate(x, y); g.rotate(o.tilt ?? 0);
  // legs
  g.lineCap = "round"; g.strokeStyle = darken(th.ufo, 0.45); g.lineWidth = s * 0.06;
  for (const k of [-0.62, 0, 0.62]) {
    const bent = o.crashed && k > 0 ? 0.12 : 0;
    g.beginPath(); g.moveTo(k * s * 0.7, s * 0.14); g.lineTo(k * s * 0.95 + bent * s, s * 0.42 - bent * s * 0.6); g.stroke();
    blob(g, k * s * 0.95 + bent * s, s * 0.44 - bent * s * 0.6, s * 0.1, s * 0.045, darken(th.ufo, 0.25), { gloss: 0.3 });
  }
  // dome back + Zib
  const domeY = -s * 0.07;
  g.save();
  g.beginPath(); g.ellipse(0, domeY, s * 0.5, s * 0.52, 0, Math.PI, 0); g.closePath();
  const dg = g.createLinearGradient(0, domeY - s * 0.5, 0, domeY);
  dg.addColorStop(0, "rgba(200,245,255,0.55)"); dg.addColorStop(1, "rgba(120,200,255,0.25)");
  g.fillStyle = dg; g.fill();
  g.clip();
  const z = o.zib;
  if (z && z.naturalWidth) {
    const h = s * 0.78, w = (h * z.naturalWidth) / z.naturalHeight;
    g.save(); g.translate(0, domeY + s * 0.06); g.rotate(o.wave ?? 0);
    g.drawImage(z, -w / 2, -h, w, h);
    g.restore();
  }
  g.restore();
  // saucer bottom + rim
  g.beginPath(); g.ellipse(0, s * 0.1, s * 0.74, s * 0.24, 0, 0, Math.PI * 2);
  clayFill(g, darken(th.ufo, 0.18), 0, s * 0.1, s * 0.74, { gloss: 0.15 });
  g.beginPath(); g.ellipse(0, 0, s, s * 0.23, 0, 0, Math.PI * 2);
  clayFill(g, th.ufo, -s * 0.15, -s * 0.06, s, { gloss: 0.5 });
  g.beginPath(); g.ellipse(0, -s * 0.03, s * 0.92, s * 0.13, 0, Math.PI * 1.05, Math.PI * 1.95); g.strokeStyle = "rgba(255,255,255,0.45)"; g.lineWidth = s * 0.03; g.stroke();
  // dome glass front
  g.beginPath(); g.ellipse(0, domeY, s * 0.5, s * 0.52, 0, Math.PI, 0); g.closePath();
  g.fillStyle = "rgba(225,250,255,0.12)"; g.fill(); g.strokeStyle = "rgba(255,255,255,0.75)"; g.lineWidth = s * 0.025; g.stroke();
  g.beginPath(); g.arc(-s * 0.08, domeY, s * 0.4, Math.PI * 1.15, Math.PI * 1.45); g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = s * 0.05; g.stroke();
  // rim lights
  const blink = o.blink ?? -1;
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.12 + (i * 0.76) / 6), lx = Math.cos(a) * s * 0.84, ly = Math.sin(a) * s * 0.15 + s * 0.02;
    const c = th.lights[i % th.lights.length], on = blink < 0 || (i + Math.floor(blink)) % 2 === 0;
    if (on) { const gl = g.createRadialGradient(lx, ly, 0, lx, ly, s * 0.16); gl.addColorStop(0, rgba(c, 0.55)); gl.addColorStop(1, rgba(c, 0)); g.fillStyle = gl; g.fillRect(lx - s * 0.16, ly - s * 0.16, s * 0.32, s * 0.32); }
    blob(g, lx, ly, s * 0.065, s * 0.05, on ? c : darken(c, 0.45), { gloss: 0.6 });
  }
  if (o.crashed) {
    // bandage + dizzy stars + smoke
    g.save(); g.translate(-s * 0.55, -s * 0.02);
    for (const r of [0.6, -0.6]) { g.save(); g.rotate(r); rr(g, -s * 0.16, -s * 0.045, s * 0.32, s * 0.09, s * 0.03); g.fillStyle = "#FFF1C9"; g.fill(); g.strokeStyle = "rgba(160,110,60,0.6)"; g.lineWidth = s * 0.012; g.stroke(); g.restore(); }
    g.restore();
    for (let i = 0; i < 3; i++) star(g, Math.cos(i * 2.1) * s * 0.42, domeY - s * 0.62 + Math.sin(i * 2.1) * s * 0.1, s * 0.07, "#FFD25A", i);
  }
  g.restore();
}

function paintPicture(th: Theme, rng: Rng, zib: HTMLImageElement | undefined) {
  const mk = () => { const c = document.createElement("canvas"); c.width = c.height = P; return c; };
  const bg = mk(), full = mk();
  const g = bg.getContext("2d")!;
  // sky + nebula
  const sk = g.createLinearGradient(0, 0, 0, P);
  sk.addColorStop(0, th.sky[0]); sk.addColorStop(0.55, th.sky[1]); sk.addColorStop(1, th.sky[2]);
  g.fillStyle = sk; g.fillRect(0, 0, P, P);
  for (let i = 0; i < 3; i++) {
    const x = rng.range(0.1, 0.9) * P, y = rng.range(0.08, 0.5) * P, r = rng.range(0.16, 0.3) * P, c = rng.pick(th.lights);
    const ng = g.createRadialGradient(x, y, 0, x, y, r); ng.addColorStop(0, rgba(c, 0.22)); ng.addColorStop(1, rgba(c, 0));
    g.fillStyle = ng; g.fillRect(0, 0, P, P);
  }
  for (let i = 0; i < 80; i++) { g.fillStyle = `rgba(255,255,255,${rng.range(0.35, 0.95)})`; g.beginPath(); g.arc(rng.range(0, P), rng.range(0, P * 0.72), rng.range(1.5, 4), 0, Math.PI * 2); g.fill(); }
  for (let i = 0; i < 5; i++) star(g, rng.range(0.05, 0.95) * P, rng.range(0.05, 0.55) * P, rng.range(11, 20), rng.pick(["#FFD25A", "#FFF4E2", "#FF8FB1", "#7CF2C9"]), rng.range(0, 1));
  // ringed planet
  const left = rng.chance(0.5);
  const px = (left ? rng.range(0.15, 0.25) : rng.range(0.75, 0.85)) * P, py = rng.range(0.14, 0.24) * P, pr = rng.range(0.085, 0.11) * P, tilt = rng.range(-0.5, 0.5);
  const ring = (front: boolean) => { g.save(); g.translate(px, py); g.rotate(tilt); g.lineWidth = pr * 0.2; g.strokeStyle = th.ring; g.lineCap = "round"; g.beginPath(); g.ellipse(0, 0, pr * 1.75, pr * 0.42, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2); g.stroke(); g.restore(); };
  ring(false);
  blob(g, px, py, pr, pr, th.planet, { gloss: 0.45 });
  g.save(); g.beginPath(); g.arc(px, py, pr, 0, Math.PI * 2); g.clip();
  g.fillStyle = rgba(darken(th.planet, 0.3), 0.35);
  for (const k of [-0.4, 0.15, 0.55]) { g.save(); g.translate(px, py + k * pr); g.rotate(tilt * 0.6); g.fillRect(-pr * 1.2, -pr * 0.07, pr * 2.4, pr * 0.14); g.restore(); }
  g.restore();
  ring(true);
  // sleepy moon with a face
  const mx = (left ? rng.range(0.66, 0.88) : rng.range(0.12, 0.34)) * P, my = rng.range(0.1, 0.3) * P, mr = rng.range(0.05, 0.065) * P;
  const mg = g.createRadialGradient(mx, my, 0, mx, my, mr * 2.4); mg.addColorStop(0, rgba(th.moon, 0.35)); mg.addColorStop(1, rgba(th.moon, 0));
  g.fillStyle = mg; g.fillRect(mx - mr * 2.4, my - mr * 2.4, mr * 4.8, mr * 4.8);
  blob(g, mx, my, mr, mr, th.moon, { gloss: 0.4 });
  for (const [cx, cy, cr] of [[0.4, -0.35, 0.18], [-0.45, 0.35, 0.14], [0.35, 0.45, 0.1]]) { g.beginPath(); g.ellipse(mx + cx * mr, my + cy * mr, cr * mr, cr * mr * 0.8, 0, 0, Math.PI * 2); g.fillStyle = rgba(darken(th.moon, 0.25), 0.5); g.fill(); }
  g.strokeStyle = "#5A1E2B"; g.lineWidth = mr * 0.08; g.lineCap = "round";
  for (const s of [-1, 1]) { g.beginPath(); g.arc(mx + s * mr * 0.32, my - mr * 0.05, mr * 0.13, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
  mouth(g, mx, my + mr * 0.32, mr * 0.35, "smile");
  // a comet or a rocket or a satellite
  const extra = rng.int(0, 2);
  const ex = rng.range(0.35, 0.65) * P, ey = rng.range(0.08, 0.2) * P;
  if (extra === 0) {
    const tg = g.createLinearGradient(ex - P * 0.18, ey - P * 0.06, ex, ey); tg.addColorStop(0, "rgba(255,255,255,0)"); tg.addColorStop(1, "rgba(255,244,200,0.85)");
    g.strokeStyle = tg; g.lineWidth = P * 0.022; g.lineCap = "round"; g.beginPath(); g.moveTo(ex - P * 0.18, ey - P * 0.06); g.lineTo(ex, ey); g.stroke();
    blob(g, ex, ey, P * 0.02, P * 0.02, "#FFF4C2", { gloss: 0.7 });
  } else if (extra === 1) {
    g.save(); g.translate(ex, ey); g.rotate(0.7);
    const fl = g.createLinearGradient(0, P * 0.03, 0, P * 0.09); fl.addColorStop(0, "#FFD25A"); fl.addColorStop(1, "rgba(255,138,61,0)");
    g.fillStyle = fl; g.beginPath(); g.moveTo(-P * 0.015, P * 0.035); g.lineTo(0, P * 0.1); g.lineTo(P * 0.015, P * 0.035); g.fill();
    blob(g, 0, 0, P * 0.022, P * 0.045, "#FFF4E2", { gloss: 0.5 });
    g.beginPath(); g.moveTo(-P * 0.02, -P * 0.025); g.quadraticCurveTo(0, -P * 0.075, P * 0.02, -P * 0.025); g.closePath(); clayFill(g, "#E8504F", 0, -P * 0.04, P * 0.03);
    blob(g, 0, -P * 0.004, P * 0.01, P * 0.01, "#7CC8FF", { gloss: 0.7 });
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * P * 0.018, P * 0.01); g.lineTo(s * P * 0.036, P * 0.04); g.lineTo(s * P * 0.016, P * 0.035); g.closePath(); g.fillStyle = "#E8504F"; g.fill(); }
    g.restore();
  } else {
    g.save(); g.translate(ex, ey); g.rotate(-0.4);
    for (const s of [-1, 1]) { rr(g, s * P * 0.035 - P * 0.025, -P * 0.012, P * 0.05, P * 0.024, 3); g.fillStyle = "#4F6FD8"; g.fill(); g.strokeStyle = "#BFD2FF"; g.lineWidth = 2; g.stroke(); }
    rr(g, -P * 0.012, -P * 0.016, P * 0.024, P * 0.032, 4); clayFill(g, "#DCD6E6", 0, 0, P * 0.02);
    g.strokeStyle = "#DCD6E6"; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -P * 0.016); g.lineTo(0, -P * 0.035); g.stroke();
    blob(g, 0, -P * 0.037, P * 0.006, P * 0.006, "#FF6F91");
    g.restore();
  }
  // bumpy clay ground
  const gy = rng.range(0.74, 0.78) * P;
  g.beginPath(); g.moveTo(0, P); g.lineTo(0, gy + rng.range(-0.03, 0.03) * P);
  const segs = 6;
  for (let i = 0; i < segs; i++) { const x0 = (i / segs) * P, x1 = ((i + 1) / segs) * P; g.quadraticCurveTo((x0 + x1) / 2, gy + rng.range(-0.07, -0.02) * P, x1, gy + rng.range(-0.015, 0.02) * P); }
  g.lineTo(P, P); g.closePath();
  clayFill(g, th.ground, P * 0.35, gy + P * 0.05, P * 0.7, { gloss: 0.25 });
  for (let i = 0; i < 6; i++) {
    const cx = rng.range(0.05, 0.95) * P, cy = rng.range(gy / P + 0.06, 0.96) * P, cr = rng.range(0.025, 0.05) * P;
    g.beginPath(); g.ellipse(cx, cy, cr, cr * 0.38, 0, 0, Math.PI * 2); g.fillStyle = rgba(darken(th.ground, 0.35), 0.55); g.fill();
    g.beginPath(); g.ellipse(cx, cy - cr * 0.08, cr, cr * 0.38, 0, Math.PI * 1.1, Math.PI * 1.9); g.strokeStyle = rgba(lighten(th.ground, 0.4), 0.7); g.lineWidth = 3; g.stroke();
  }
  // alien plants & a tiny critter, kept to the sides so every tile has something to look at
  for (let i = 0; i < 5; i++) {
    const side = i % 2 ? rng.range(0.03, 0.22) : rng.range(0.78, 0.97);
    const x = side * P, y = gy + rng.range(0.0, 0.06) * P, hgt = rng.range(0.07, 0.14) * P, lean = rng.range(-0.3, 0.3);
    g.strokeStyle = darken(th.plant, 0.3); g.lineWidth = P * 0.012; g.lineCap = "round";
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + lean * hgt, y - hgt * 0.6, x + lean * hgt * 0.5, y - hgt); g.stroke();
    blob(g, x + lean * hgt * 0.5, y - hgt, P * 0.022, P * 0.022, i % 3 ? th.plant : rng.pick(th.lights), { gloss: 0.6 });
    blob(g, x - P * 0.012, y - hgt * 0.35, P * 0.014, P * 0.007, "#74C94E", { rot: -0.5 });
  }
  for (let i = 0; i < 2; i++) {
    const cx = (i ? rng.range(0.1, 0.24) : rng.range(0.76, 0.9)) * P, cy = rng.range(0.88, 0.93) * P, cr = P * rng.range(0.03, 0.04), c = rng.pick(["#FF8FB1", "#FFD25A", "#7CF2C9", "#B7A2E8", "#FF8A3D"]);
    shadow(g, cx, cy + cr * 0.9, cr, cr * 0.3, 0.3);
    blob(g, cx, cy, cr, cr * 0.85, c, { gloss: 0.5 });
    eye(g, cx, cy - cr * 0.15, cr * 0.38, { look: [i ? 0.5 : -0.5, -0.2] });
    mouth(g, cx, cy + cr * 0.45, cr * 0.5, "smile");
  }
  // UFO (crashed) on the full picture
  const ufo: UfoPose = { x: P * rng.range(0.47, 0.53), y: gy - P * 0.15, s: P * 0.28, tilt: rng.range(0.1, 0.2) * (rng.chance(0.5) ? 1 : -1) };
  const f = full.getContext("2d")!;
  f.drawImage(bg, 0, 0);
  shadow(f, ufo.x, gy + P * 0.01, ufo.s * 1.1, ufo.s * 0.18, 0.4);
  drawUfo(f, ufo.x, ufo.y, ufo.s, th, { tilt: ufo.tilt, zib, crashed: true });
  // smoke puffs
  for (let i = 0; i < 3; i++) blob(f, ufo.x + ufo.s * (0.75 + i * 0.12) * Math.sign(ufo.tilt || 1), ufo.y - ufo.s * (0.45 + i * 0.32), ufo.s * (0.13 + i * 0.05), ufo.s * (0.11 + i * 0.04), i % 2 ? "#C9C1D9" : "#E4DEEF", { gloss: 0.4 });
  return { bg, full, ufo };
}

export default class SlideShip extends ArcadeGame {
  readonly meta: GameMeta = {
    slug: "slide-ship", title: "Slide Ship", host: "zib", style: "rounds",
    music: { calm: "a:ship_calm", action: "a:ship_action" },
    sounds: ["slide", "a:click", "a:tink", "a:bonk", "a:ufo", "a:rocket", "a:cheer", "a:twinkle", "sparkle", "snicker", "a:clunk", "a:zap", "a:squeak", "a:poof", "v:zib_laugh", "v:kranky_laugh"],
    sprites: [KRANKY, KRANKY_LAUGH], voicePitch: 1.5, transition: "iris",
  };
  private n = 3;
  private cells: number[] = [];   // cells[pos] = tile id; id n*n-1 is the hole
  private tiles: Tile[] = [];
  private gap = 8;
  private par = 0; private moves = 0; private fuelMax = 0;
  private theme: Theme = THEMES[0];
  private pic: HTMLCanvasElement | null = null;
  private picBg: HTMLCanvasElement | null = null;
  private ufo: UfoPose = { x: P / 2, y: P / 2, s: P * 0.28, tilt: 0 };
  private phase: Phase = "intro";
  private nums = false; private canPeek = false; private peekT = 0; private peeks = 0;
  private twist = { kranky: false, fuel: false };
  private kr = { x: -1, done: 0, laugh: 0 };
  private join = { u: 0, pop: 0, glow: 0 };
  private fly = { u: 0 };
  private startT = 0; private budget = 60; private lastBar = -1;
  private homeSeen = new Set<number>();
  private bumps = 0; private bad3 = 0; private hl = 0;
  private board = { x: 0, y: 0, s: 300 };
  private zib = { x: 0, y: 0, h: 120, bop: 0 };
  private prev = { x: 0, y: 0, s: 100 };
  private peekBtn = { x: 0, y: 0, w: 64, h: 58, press: 0 };
  private stats = { x: 0, y: 0, w: 100 };
  private themeBag = new Bag<number>(THEMES.map((_, i) => i));
  private twistBag = new Bag<string>(["kranky", "fuel"]);
  private recent = new Recent(24);
  private lastN = 0;
  private sky?: HTMLCanvasElement;
  private dots = Array.from({ length: 60 }, (_, i) => ({ x: (i * 0.618034) % 1, y: (i * 0.41421) % 1, p: i * 1.37, s: 1 + (i % 3) }));

  private laid = { w: 0, h: 0 };
  protected onResize() {
    // HUD bubbles briefly stack while they swap; don't let the board jump for that
    if (this.hud.status === "playing" && this.W === this.laid.w && this.H === this.laid.h) { this.after(0.7, () => this.relayout(), false); return; }
    this.relayout();
  }
  private relayout() { this.laid = { w: this.W, h: this.H }; this.layout(); this.sky = undefined; }

  private layout() {
    const A = this.area, portrait = this.W < this.H * 1.05;
    if (portrait) {
      const panelH = clamp(A.h * 0.22, 120, 170);
      const side = Math.min(this.W - 20, A.h - panelH - 12, 640);
      this.board = { x: (this.W - side) / 2, y: A.y + 4 + Math.max(0, (A.h - panelH - 12 - side) * 0.3), s: side };
      const top = this.board.y + side + 8, bot = A.y + A.h;
      const ph = bot - top;
      this.zib = { ...this.zib, x: Math.max(58, this.W * 0.16), y: bot + 2, h: clamp(ph * 0.9, 90, 160) };
      const ps = clamp(Math.min(ph - 44, this.W * 0.3), 70, 130);
      const cy = top + ph * 0.55;
      this.prev = { x: this.W * 0.5 - ps / 2 + 2, y: cy - ps / 2, s: ps };
      this.stats = { x: this.W * 0.84, y: cy - ps / 2 - 4, w: this.W * 0.28 };
      this.peekBtn = { ...this.peekBtn, w: 66, h: 56, x: this.W * 0.84 - 33, y: bot - 60 };
    } else {
      const side = Math.min(A.h - 16, this.W * 0.52, 700);
      this.board = { x: (this.W - side) / 2, y: A.y + (A.h - side) / 2, s: side };
      const lw = this.board.x, rx = this.board.x + side;
      this.zib = { ...this.zib, x: lw / 2, y: A.y + A.h - 4, h: clamp(Math.min(lw * 0.9, A.h * 0.42), 90, 260) };
      const ps = clamp(Math.min(this.W - rx - 40, A.h * 0.32), 80, 220);
      this.prev = { x: rx + (this.W - rx - ps) / 2, y: A.y + A.h * 0.08 + 18, s: ps };
      this.stats = { x: rx + (this.W - rx) / 2, y: this.prev.y + ps + 28, w: Math.min(220, this.W - rx - 30) };
      this.peekBtn = { ...this.peekBtn, w: 76, h: 62, x: rx + (this.W - rx) / 2 - 38, y: this.prev.y + ps + 130 };
    }
  }

  private geo() {
    const b = this.board, pad = b.s * 0.035, cell = (b.s - pad * 2) / this.n;
    return { pad, cell, gp: Math.max(2, cell * 0.045) };
  }
  private tileRect(r: number, c: number) {
    const b = this.board, { pad, cell, gp } = this.geo();
    const k = 1 - this.join.u, gg = gp * k;
    return { x: b.x + pad + c * cell + gg / 2, y: b.y + pad + r * cell + gg / 2, s: cell - gg };
  }

  // ------------------------------------------------------------ levels
  private sizeAt(L: number) {
    const s = byDiff(this.diff, { easy: [9, 21], medium: [5, 14], hard: [3, 9] });
    return { n: L >= s[1] ? 5 : L >= s[0] ? 4 : 3, k: L - (L >= s[1] ? s[1] : L >= s[0] ? s[0] : 1) + 1 };
  }

  protected setupLevel() {
    const L = this.level, d = this.diff;
    const { n, k } = this.sizeAt(L);
    this.n = n;
    const depth = n === 3 ? byDiff(d, { easy: ramp(k, 4, 2, 22), medium: ramp(k, 8, 3, 28), hard: ramp(k, 14, 4, 30) })
      : n === 4 ? byDiff(d, { easy: ramp(k, 10, 3, 46), medium: ramp(k, 14, 4, 60), hard: ramp(k, 20, 5, 80) })
        : byDiff(d, { easy: ramp(k, 16, 3, 70), medium: ramp(k, 22, 4, 90), hard: ramp(k, 30, 5, 120) });
    this.twist.kranky = byDiff(d, { easy: L >= 14 && L % 4 === 2, medium: L >= 8 && L % 3 === 2, hard: L >= 4 && L % 3 === 1 });
    this.twist.fuel = byDiff(d, { easy: false, medium: L >= 16 && L % 4 === 0, hard: L >= 6 && L % 3 === 0 });
    // deep into the game every level gets a twist (no-repeat bag)
    if (L >= byDiff(d, { easy: 18, medium: 11, hard: 7 }) && !this.twist.kranky && !this.twist.fuel) {
      if (this.twistBag.next(this.rng) === "kranky") this.twist.kranky = true; else this.twist.fuel = true;
    }
    this.nums = d === "easy" || (d === "medium" && L <= 3);
    this.canPeek = !this.nums;
    // fresh picture + a scramble never seen recently
    const ti = this.themeBag.next(this.rng);
    this.theme = THEMES[ti];
    let cells: number[] = [];
    for (let tries = 0; tries < 30; tries++) {
      cells = this.scramble(depth);
      const sig = `${n}:${cells.join(",")}`;
      if (!this.recent.has(sig) && this.misplaced(cells) >= Math.min(n * n - 1, Math.max(2, Math.ceil(depth * 0.35)))) { this.recent.add(sig); break; }
    }
    const pic = paintPicture(this.theme, this.rng, this.img(ZIB_HAPPY));
    this.pic = pic.full; this.picBg = pic.bg; this.ufo = pic.ufo;
    this.cells = cells;
    this.gap = cells.indexOf(n * n - 1);
    // tiles start at home (the intact ship) and get jumbled by the crash
    this.tiles = [];
    for (let pos = 0; pos < n * n; pos++) {
      const id = cells[pos];
      if (id === n * n - 1) continue;
      this.tiles.push({ id, r: Math.floor(pos / n), c: pos % n, dr: Math.floor(id / n), dc: id % n, spd: 18, wig: 0 });
    }
    this.homeSeen = new Set(this.tiles.filter((t) => this.isHome(t)).map((t) => t.id));
    this.par = depth; this.moves = 0; this.peeks = 0; this.peekT = 0; this.bumps = 0; this.bad3 = 0; this.hl = 0;
    this.fuelMax = this.twist.fuel ? depth * byDiff(d, { easy: 3, medium: 2, hard: 2 }) + 8 : 0;
    this.kr = { x: -1, done: 0, laugh: 0 };
    this.join = { u: 0, pop: 0, glow: 0 }; this.fly = { u: 0 };
    this.budget = (depth * byDiff(d, { easy: 2.6, medium: 2.0, hard: 1.6 }) + 10);
    this.lastBar = -1; this.timerBar(null);
    this.layout();
    this.phase = "intro";
    this.music(n >= 5 || this.twist.kranky || this.twist.fuel ? "action" : "calm");
    // announcements
    const twists: [string, string, "gold" | "mint" | "pink" | "navy" | "red"][] = [];
    if (n !== this.lastN && this.lastN && n > this.lastN) twists.push(["BIGGER SHIP!", `${n}×${n} tiles now`, "mint"]);
    if (d === "medium" && L === 4) twists.push(["NO NUMBERS!", "Use the picture · tap 123 to peek", "pink"]);
    if (this.twist.kranky) twists.push(["KRANKY ALERT!", "He might bump your ship!", "red"]);
    if (this.twist.fuel) twists.push(["FUEL LIMIT!", `Fix it in ${this.fuelMax} moves`, "gold"]);
    this.lastN = n;
    twists.forEach((tw, i) => this.after(0.5 + i * 1.7, () => this.banner(tw[0], tw[1], tw[2])));
    this.react("sad", this.rng.pick(["Blorp! My UFO went SPLAT!", "Zib-zab! My ship is in pieces!", "Oopsie… crash landing!", "Help me fix my saucer!", "Bleep bloop… it's broken!"]));
    this.hint(L === 1 ? "Look at Zib's ship… then it gets jumbled! 👀" : "Remember the picture! 👀");
    const look = this.attempt ? 0.6 : byDiff(d, { easy: 1.6, medium: 1.3, hard: 1.0 });
    this.after(look + twists.length * 0.6, () => this.crash());
  }

  private crash() {
    this.phase = "play";
    for (const t of this.tiles) t.spd = 5 + this.rng.next() * 4;
    this.sfx("a:zap", { gain: 0.5 }); this.sfx("slide", { gain: 0.6, delay: 0.05 }); this.sfx("a:poof", { gain: 0.5 });
    const R = this.tileRect(this.n - 1, this.n - 1);
    this.burst(R.x + R.s / 2, R.y + R.s / 2, { n: 16, colors: ["#E4DEEF", "#C9C1D9", "#FFFFFF"], kind: "dot", speed: 200, gravity: -60, size: 9 });
    this.shake(8, 0.3);
    this.zib.bop = 1;
    this.startT = this.t;
    const ex = this.n === 3 && this.level <= 2;
    this.hint(ex ? "Tap a tile next to the hole to slide it! 👆" : this.twist.fuel ? `Fix the ship! Fuel: ${this.fuelMax} moves ⛽` : `Fix Zib's ship! Par ${this.par} moves 🛸`);
  }

  private scramble(depth: number) {
    const n = this.n, N = n * n;
    const cells = Array.from({ length: N }, (_, i) => i);
    let gap = N - 1, prev = -1;
    for (let k = 0; k < depth; k++) {
      const opts = this.neighbours(gap).filter((p) => p !== prev);
      const p = this.rng.pick(opts);
      cells[gap] = cells[p]; cells[p] = N - 1; prev = gap; gap = p;
    }
    return cells;
  }
  private neighbours(pos: number) {
    const n = this.n, r = Math.floor(pos / n), c = pos % n, o: number[] = [];
    if (r > 0) o.push(pos - n);
    if (r < n - 1) o.push(pos + n);
    if (c > 0) o.push(pos - 1);
    if (c < n - 1) o.push(pos + 1);
    return o;
  }
  private misplaced(cells: number[]) { let m = 0; cells.forEach((id, i) => { if (id !== cells.length - 1 && id !== i) m++; }); return m; }
  private isHome(t: Tile) { return t.r * this.n + t.c === t.id; }
  private tileAt(pos: number) { const id = this.cells[pos]; return this.tiles.find((t) => t.id === id); }

  // ------------------------------------------------------------ input
  protected onDown(x: number, y: number) {
    const pb = this.peekBtn;
    if (this.canPeek && x >= pb.x - 6 && x <= pb.x + pb.w + 6 && y >= pb.y - 6 && y <= pb.y + pb.h + 6) { this.peek(); return; }
    if (this.phase !== "play") return;
    const b = this.board, { pad, cell } = this.geo();
    const c = Math.floor((x - b.x - pad) / cell), r = Math.floor((y - b.y - pad) / cell);
    if (r < 0 || c < 0 || r >= this.n || c >= this.n) return;
    this.tryMove(r * this.n + c);
  }

  onKey(key: string) {
    const k = key.toLowerCase();
    if (k === "h" || k === "n") { this.peek(); return; }
    if (this.phase !== "play") return;
    const n = this.n, gr = Math.floor(this.gap / n), gc = this.gap % n;
    // arrow = the direction the tile travels into the hole
    const from = k === "arrowup" || k === "w" ? [gr + 1, gc] : k === "arrowdown" || k === "s" ? [gr - 1, gc] : k === "arrowleft" || k === "a" ? [gr, gc + 1] : k === "arrowright" || k === "d" ? [gr, gc - 1] : null;
    if (!from) return;
    if (from[0] < 0 || from[1] < 0 || from[0] >= n || from[1] >= n) { this.sfx("a:bonk", { gain: 0.35 }); this.hl = 1; return; }
    this.tryMove(from[0] * n + from[1]);
  }

  private peek() {
    if (!this.canPeek || this.peekT > 0 || (this.phase !== "play" && this.phase !== "intro")) return;
    this.peekT = 3; this.peeks++;
    this.peekBtn.press = 1; this.tween(this.peekBtn, { press: 0 }, 0.3);
    const cost = byDiff(this.diff, { easy: 0, medium: 20, hard: 35 });
    if (cost && this.score > 0) { const c = Math.min(cost, this.score); this.addRaw(-c); this.float(`-${c}`, this.peekBtn.x + this.peekBtn.w / 2, this.peekBtn.y - 10, "#FF8FB1", 24); }
    this.sfx("a:twinkle", { gain: 0.6 });
    this.react("wow", this.rng.pick(["Peekaboo numbers!", "Psst… here's a clue!", "Zib-vision ON!"]), false);
  }

  private tryMove(pos: number) {
    const n = this.n, N = n * n;
    if (pos === this.gap) return;
    const gr = Math.floor(this.gap / n), gc = this.gap % n, r = Math.floor(pos / n), c = pos % n;
    if (r !== gr && c !== gc) {
      const t = this.tileAt(pos);
      if (t) t.wig = 1;
      this.hl = 1; this.bad3++;
      this.combo = 0; this.setHud({ combo: 0, mult: 1 });
      this.sfx("a:bonk", { gain: 0.5, x: this.board.x + (c + 0.5) * (this.board.s / n) });
      if (this.bad3 % 3 === 1) this.react("wow", this.rng.pick(["Only tiles next to the hole slide!", "Bleep? That one's stuck!", "Nope! Try a glowing tile!"]));
      return;
    }
    const step = r === gr ? (c > gc ? 1 : -1) : r > gr ? n : -n;
    let p = this.gap, moved = 0;
    const movedTiles: Tile[] = [];
    while (p !== pos) {
      const q = p + step;
      this.cells[p] = this.cells[q]; this.cells[q] = N - 1;
      const t = this.tiles.find((x) => x.id === this.cells[p])!;
      t.r = Math.floor(p / n); t.c = p % n; t.spd = 20;
      movedTiles.push(t);
      p = q; moved++;
    }
    this.gap = pos;
    this.moves += moved;
    this.zib.bop = 0.6;
    const R = this.board.s / n;
    const lx = this.board.x + (c + 0.5) * R;
    this.sfx("slide", { x: lx, gain: 0.45, rate: 1.05 + Math.random() * 0.2 - moved * 0.05 });
    this.sfx("a:click", { x: lx, gain: 0.35, delay: 0.09, rate: 0.9 + Math.random() * 0.2 });
    // first time a tile reaches home → reward
    for (const t of movedTiles) {
      if (this.isHome(t) && !this.homeSeen.has(t.id)) {
        this.homeSeen.add(t.id);
        const tr = this.tileRect(t.r, t.c);
        this.good(tr.x + tr.s / 2, tr.y + tr.s / 2, 10);
      }
    }
    if (this.isSolved()) { this.solved(); return; }
    if (this.twist.fuel) {
      const left = this.fuelMax - this.moves;
      if (left <= 0) {
        this.phase = "out"; this.timerBar(null);
        this.sfx("a:clunk", { gain: 0.7 }); this.sfx("a:squeak", { gain: 0.5, delay: 0.3 });
        this.after(0.4, () => this.levelFail("Out of fuel! ⛽"));
        return;
      }
      if (left === 5) { this.react("wow", "Fuel is low! Hurry!"); this.music("action"); }
    }
    if (this.twist.kranky && !this.kr.done && this.moves >= Math.max(3, Math.floor(this.par * 0.35))) this.krankyBump();
  }

  private isSolved() { for (let i = 0; i < this.cells.length; i++) if (this.cells[i] !== i) return false; return true; }

  private krankyBump() {
    this.kr.done = 1; this.phase = "bump";
    this.sfx("snicker", { gain: 0.6 });
    this.kr.x = -0.3;
    this.tween(this.kr, { x: 0.5 }, 0.7, ease.out);
    this.after(0.75, () => {
      this.banner("KRANKY BUMP!", "He bonked your ship!", "red");
      this.shake(14, 0.4); this.flash("#ffffff", 0.2);
      this.sfx("a:bonk", { gain: 0.8 }); this.sfx("v:kranky_laugh", { gain: 0.7, delay: 0.2 });
      this.kr.laugh = 1;
      this.react("sad", this.rng.pick(["Hey! Kranky!", "Noooo, my tiles!", "Grr, crabby crab!"]));
      const n = this.n, N = n * n;
      let prev = -1;
      for (let i = 0; i < 3; i++) {
        this.after(0.15 + i * 0.18, () => {
          let opts = this.neighbours(this.gap).filter((p) => p !== prev);
          if (!opts.length) opts = this.neighbours(this.gap);
          const p = this.rng.pick(opts);
          this.cells[this.gap] = this.cells[p]; this.cells[p] = N - 1;
          const t = this.tiles.find((x) => x.id === this.cells[this.gap])!;
          t.r = Math.floor(this.gap / n); t.c = this.gap % n; t.spd = 14; t.wig = 0.6;
          prev = this.gap; this.gap = p;
          this.sfx("slide", { gain: 0.4, rate: 1.2 });
        });
      }
      this.after(0.8, () => {
        this.par += 3; if (this.fuelMax) this.fuelMax += 3;
        this.bumps++;
        this.tween(this.kr, { x: 1.35 }, 0.6, ease.in);
        if (this.isSolved()) { this.solved(); return; }
        this.phase = "play";
        this.hint(`Kranky bumped it! Par is now ${this.par} 🦀`);
      });
    });
  }

  private solved() {
    this.phase = "solved"; this.hint(null);
    const elapsed = this.t - this.startT;
    const timeFrac = clamp(1 - elapsed / this.budget, 0, 1);
    const bonus = Math.round(timeFrac * (40 + this.level * 6)) + Math.max(0, Math.round((this.par * 2 - this.moves) * 3));
    const perfect = this.moves <= this.par && this.peeks === 0;
    this.timerBar(null);
    this.sfx("a:tink", { gain: 0.6 }); this.sfx("sparkle", { gain: 0.6, delay: 0.25 });
    this.tween(this.join, { pop: 1 }, 0.4, ease.back);
    this.tween(this.join, { u: 1 }, 0.45, ease.inOut, 0.3);
    this.after(0.75, () => {
      this.join.glow = 1;
      const b = this.board;
      for (let i = 0; i < 4; i++) this.burst(b.x + (i % 2 ? b.s : 0), b.y + (i < 2 ? 0 : b.s), { n: 12, colors: ["#FFD25A", "#FFFFFF", "#7CF2C9", "#FF8FB1"], kind: "star", speed: 260 });
      this.sfx("a:cheer", { gain: 0.6 });
      this.react("happy", this.rng.pick(["Ship fixed! Wheee!", "Zoom zoom! Bye-bye!", "To the stars!", "Blast off, baby!"]));
    });
    this.after(1.1, () => {
      this.phase = "fly";
      this.sfx("a:ufo", { gain: 0.7 });
      this.sfx("a:rocket", { gain: 0.6, delay: 0.6 });
      this.tween(this.fly, { u: 1 }, 1.7, ease.linear);
    });
    this.after(2.2, () => this.levelClear({ perfect, bonus, title: perfect ? "PERFECT FIX!" : this.rng.pick(["SHIP FIXED!", "BLAST OFF!", "ZOOM!"]) }));
  }

  protected update(dt: number) {
    for (const t of this.tiles) {
      if (this.phase === "intro") break;
      const k = Math.min(1, dt * t.spd);
      t.dr += (t.r - t.dr) * k; t.dc += (t.c - t.dc) * k;
      if (Math.abs(t.r - t.dr) < 0.002) t.dr = t.r;
      if (Math.abs(t.c - t.dc) < 0.002) t.dc = t.c;
      t.wig = Math.max(0, t.wig - dt * 2.4);
    }
    if (this.peekT > 0) this.peekT = Math.max(0, this.peekT - dt);
    this.hl = Math.max(0, this.hl - dt * 1.2);
    this.zib.bop = Math.max(0, this.zib.bop - dt * 3);
    this.kr.laugh = Math.max(0, this.kr.laugh - dt * 0.8);
    if (this.join.glow > 0) this.join.glow = Math.max(0, this.join.glow - dt * 0.5);
    if ((this.phase === "play" || this.phase === "bump") && this.diff !== "easy") {
      const v = Math.round(clamp(1 - (this.t - this.startT) / this.budget, 0, 1) * 50) / 50;
      if (v !== this.lastBar) { this.lastBar = v; this.timerBar(v, v > 0.3 ? "#FFD25A" : "#FF8FB1"); }
    }
    if (this.phase === "fly" && this.fly.u > 0.18 && this.fly.u < 0.95) {
      const p = this.ufoScreen();
      if (Math.random() < 0.7) this.particles.push({ x: p.x + (Math.random() - 0.5) * p.s * 0.6, y: p.y + p.s * 0.3, vx: (Math.random() - 0.5) * 60, vy: 80 + Math.random() * 80, life: 0.7, max: 0.7, size: 4 + Math.random() * 5, color: this.rng.pick(this.theme.lights), kind: Math.random() < 0.5 ? "star" : "dot", rot: 0, vr: 3, g: 0 });
    }
  }

  // ------------------------------------------------------------ drawing
  private ufoScreen() {
    const b = this.board, k = b.s / P, u = this.fly.u;
    const lift = ease.out(clamp(u / 0.3, 0, 1)), v = clamp((u - 0.3) / 0.7, 0, 1), vv = ease.in(v);
    const x = b.x + this.ufo.x * k + vv * this.W * 0.7 + Math.sin(u * 14) * 4 * (1 - v);
    const y = b.y + this.ufo.y * k - lift * b.s * 0.12 - vv * (b.y + b.s + 200) + Math.sin(this.t * 6) * 3;
    return { x, y, s: this.ufo.s * k * (1 + lift * 0.12 - vv * 0.4), tilt: lerp(this.ufo.tilt, -0.25 * v, lift) };
  }

  private drawSpace(g: G) {
    const W = this.W, H = this.H;
    if (!this.sky || this.sky.width !== Math.round(W) || this.sky.height !== Math.round(H)) {
      const c = document.createElement("canvas"); c.width = Math.round(W); c.height = Math.round(H);
      const x = c.getContext("2d")!;
      const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#0D0726"); gr.addColorStop(0.55, "#24124F"); gr.addColorStop(1, "#3A1C6B");
      x.fillStyle = gr; x.fillRect(0, 0, W, H);
      for (const [cx, cy, r, col] of [[0.15, 0.25, 0.45, "#9B5DE5"], [0.85, 0.6, 0.5, "#2EC4B6"], [0.5, 0.95, 0.6, "#FF6F91"]] as [number, number, number, string][]) {
        const ng = x.createRadialGradient(cx * W, cy * H, 0, cx * W, cy * H, r * Math.max(W, H)); ng.addColorStop(0, rgba(col, 0.16)); ng.addColorStop(1, rgba(col, 0));
        x.fillStyle = ng; x.fillRect(0, 0, W, H);
      }
      // distant planet + ground horizon
      const land = W > H * 1.05;
      blob(x, W * (land ? 0.93 : 0.9), H * (land ? 0.84 : 0.34), Math.min(W, H) * 0.07, Math.min(W, H) * 0.07, "#FF8A3D", { gloss: 0.4 });
      blob(x, W * 0.08, H * 0.42, Math.min(W, H) * 0.035, Math.min(W, H) * 0.035, "#7CF2C9", { gloss: 0.5 });
      const hy = H - Math.max(30, (H - this.board.y - this.board.s) * 0.55);
      x.beginPath(); x.moveTo(0, H); x.lineTo(0, hy + 20); x.quadraticCurveTo(W / 2, hy - 30, W, hy + 20); x.lineTo(W, H); x.closePath();
      clayFill(x, "#6A4BB0", W / 2, hy + H * 0.2, Math.max(W, H * 0.4), { gloss: 0.15 });
      for (let i = 0; i < 9; i++) { const cx = ((i * 0.37 + 0.1) % 1) * W, cy = hy + 30 + ((i * 0.53) % 1) * (H - hy - 30); x.beginPath(); x.ellipse(cx, cy, 26 + (i % 3) * 10, 8 + (i % 3) * 3, 0, 0, Math.PI * 2); x.fillStyle = "rgba(40,20,80,0.35)"; x.fill(); }
      this.sky = c;
    }
    g.drawImage(this.sky, 0, 0, W, H);
    for (const s of this.dots) {
      const a = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(this.t * 1.8 + s.p));
      g.fillStyle = `rgba(255,255,255,${a})`; g.beginPath(); g.arc(s.x * W, s.y * H * 0.8, s.s * 0.9, 0, Math.PI * 2); g.fill();
    }
    // a shooting star now and then
    const st = (this.t * 0.25) % 1;
    if (st < 0.12) {
      const u = st / 0.12, sx = W * (0.1 + u * 0.5), sy = H * (0.05 + u * 0.15);
      const tg = g.createLinearGradient(sx - 70, sy - 22, sx, sy); tg.addColorStop(0, "rgba(255,255,255,0)"); tg.addColorStop(1, `rgba(255,255,255,${0.8 * (1 - u)})`);
      g.strokeStyle = tg; g.lineWidth = 3; g.lineCap = "round"; g.beginPath(); g.moveTo(sx - 70, sy - 22); g.lineTo(sx, sy); g.stroke();
    }
  }

  private drawBoard(g: G) {
    const b = this.board;
    shadow(g, b.x + b.s / 2, b.y + b.s + 6, b.s * 0.5, 16, 0.35);
    if (this.join.glow > 0) {
      g.save(); g.shadowColor = "#FFE38A"; g.shadowBlur = 40 * this.join.glow;
      rr(g, b.x - 4, b.y - 4, b.s + 8, b.s + 8, 26); g.fillStyle = rgba("#FFE38A", 0.6 * this.join.glow); g.fill();
      g.restore();
    }
    clayPanel(g, b.x - 8, b.y - 8, b.s + 16, b.s + 24, 24, "#5B3FA8", { lip: 10 });
    // rivets
    for (const [rx, ry] of [[b.x + 4, b.y + 2], [b.x + b.s - 4, b.y + 2], [b.x + 4, b.y + b.s - 2], [b.x + b.s - 4, b.y + b.s - 2]]) blob(g, rx, ry, 4, 4, "#C9B8FF", { gloss: 0.6 });
    const { pad } = this.geo();
    rr(g, b.x + pad * 0.5, b.y + pad * 0.5, b.s - pad, b.s - pad, 16); g.fillStyle = "#120A2A"; g.fill();
    if (!this.pic) return;
    const n = this.n, N = n * n;
    if (this.join.u >= 1) {
      // the picture is whole again
      const R = this.tileRect(0, 0), S = R.s * n;
      g.save(); rr(g, R.x, R.y, S, S, 10); g.clip();
      g.drawImage(this.phase === "fly" ? this.picBg! : this.pic, R.x, R.y, S, S);
      g.restore();
      rr(g, R.x, R.y, S, S, 10); g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 2; g.stroke();
      return;
    }
    const intro = this.phase === "intro" && this.hud.status === "playing";
    if (intro) this.drawTile(g, N - 1, n - 1, n - 1, 0, 0, -1);
    // the hole: a little window into deep space
    else if (this.phase !== "solved" || this.join.pop < 0.05) {
      const gr = this.tileRect(Math.floor(this.gap / n), this.gap % n);
      rr(g, gr.x, gr.y, gr.s, gr.s, gr.s * 0.14); g.fillStyle = "#08041A"; g.fill();
      for (let i = 0; i < 4; i++) { const a = 0.3 + 0.5 * Math.abs(Math.sin(this.t * 2 + i * 1.9)); g.fillStyle = `rgba(255,255,255,${a})`; g.beginPath(); g.arc(gr.x + gr.s * (0.2 + ((i * 0.37) % 0.6)), gr.y + gr.s * (0.25 + ((i * 0.53) % 0.5)), 1.6, 0, Math.PI * 2); g.fill(); }
    }
    // tiles that can slide get a soft glow (always on the first levels, or after a wrong tap)
    const showMov = this.phase === "play" && (this.hl > 0 || (this.n === 3 && this.level <= 3) || this.diff === "easy");
    const gr0 = Math.floor(this.gap / n), gc0 = this.gap % n;
    for (const t of this.tiles) {
      const movable = showMov && (t.r === gr0 || t.c === gc0);
      this.drawTile(g, t.id, t.dr, t.dc, t.wig, movable ? (this.hl > 0 ? this.hl : 0.5 + 0.2 * Math.sin(this.t * 5)) : 0, t.r === gr0 && Math.abs(t.c - gc0) === 1 ? (t.c < gc0 ? 0 : 2) : t.c === gc0 && Math.abs(t.r - gr0) === 1 ? (t.r < gr0 ? 1 : 3) : -1);
    }
    if (this.phase === "solved" && this.join.pop > 0.02) {
      const id = N - 1, R = this.tileRect(n - 1, n - 1);
      g.save(); g.translate(R.x + R.s / 2, R.y + R.s / 2); g.scale(this.join.pop, this.join.pop); g.translate(-R.x - R.s / 2, -R.y - R.s / 2);
      this.drawTile(g, id, n - 1, n - 1, 0, 0, -1);
      g.restore();
    }
  }

  /** one picture tile with a clay bevel; arrow = direction (0 →,1 ↓,2 ←,3 ↑) into the hole */
  private drawTile(g: G, id: number, r: number, c: number, wig: number, glow: number, arrow: number) {
    const n = this.n, R = this.tileRect(r, c), k = 1 - this.join.u;
    const rad = R.s * 0.14 * k + 2, src = P / n, hr = Math.floor(id / n), hc = id % n;
    const moving = Math.abs(r - Math.round(r)) + Math.abs(c - Math.round(c));
    const sx = Math.round(c) !== c ? 1 + Math.min(0.08, moving * 0.3) : 1 - Math.min(0.05, moving * 0.2);
    const sy = Math.round(r) !== r ? 1 + Math.min(0.08, moving * 0.3) : 1 - Math.min(0.05, moving * 0.2);
    g.save();
    g.translate(R.x + R.s / 2 + Math.sin(wig * 28) * wig * 6, R.y + R.s / 2);
    g.scale(moving > 0.01 ? sx : 1, moving > 0.01 ? sy : 1);
    const x = -R.s / 2, y = -R.s / 2, lip = Math.max(2, R.s * 0.05) * k;
    if (lip > 0.5) { rr(g, x, y + lip, R.s, R.s, rad); g.fillStyle = "rgba(10,4,30,0.55)"; g.fill(); }
    if (glow > 0) { g.save(); g.shadowColor = "#7CF2C9"; g.shadowBlur = 16 * glow; rr(g, x, y, R.s, R.s, rad); g.fillStyle = rgba("#7CF2C9", 0.9); g.fill(); g.restore(); }
    g.save(); rr(g, x, y, R.s, R.s, rad); g.clip();
    g.drawImage(this.pic!, hc * src, hr * src, src, src, x, y, R.s, R.s);
    if (k > 0.01) {
      const bv = g.createLinearGradient(0, y, 0, y + R.s);
      bv.addColorStop(0, `rgba(255,255,255,${0.28 * k})`); bv.addColorStop(0.25, "rgba(255,255,255,0)"); bv.addColorStop(0.8, "rgba(0,0,0,0)"); bv.addColorStop(1, `rgba(20,8,40,${0.3 * k})`);
      g.fillStyle = bv; g.fillRect(x, y, R.s, R.s);
    }
    g.restore();
    rr(g, x, y, R.s, R.s, rad);
    g.strokeStyle = glow > 0 ? rgba("#B8FFE8", 0.6 + glow * 0.4) : `rgba(255,255,255,${0.4 * k})`; g.lineWidth = glow > 0 ? 3 : 1.5; g.stroke();
    // number badge
    const showN = (this.nums || this.peekT > 0) && this.phase !== "fly" && this.join.u < 0.5;
    if (showN) {
      const a = this.nums ? 1 : Math.min(1, this.peekT * 2);
      const br = clamp(R.s * 0.15, 9, 16), bx = x + br + 3, by = y + br + 3;
      const home = r * n + c === id;
      g.save(); g.globalAlpha *= a;
      blob(g, bx, by, br, br, home ? "#2EC4B6" : "#23305A", { gloss: 0.4 });
      g.font = `${Math.round(br * 1.25)}px "Lilita One", system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#FFFFFF";
      g.fillText(String(id + 1), bx, by + 1);
      g.restore();
    }
    // tiny arrow on tiles touching the hole
    if (arrow >= 0 && glow > 0) {
      const ax = [R.s * 0.32, 0, -R.s * 0.32, 0][arrow], ay = [0, R.s * 0.32, 0, -R.s * 0.32][arrow], s = clamp(R.s * 0.1, 6, 12);
      g.save(); g.translate(ax + Math.cos((arrow * Math.PI) / 2) * Math.sin(this.t * 6) * 3, ay + Math.sin((arrow * Math.PI) / 2) * Math.sin(this.t * 6) * 3); g.rotate((arrow * Math.PI) / 2);
      g.beginPath(); g.moveTo(s, 0); g.lineTo(-s * 0.6, -s * 0.8); g.lineTo(-s * 0.6, s * 0.8); g.closePath();
      g.fillStyle = "rgba(255,255,255,0.92)"; g.fill(); g.strokeStyle = "#1E9C91"; g.lineWidth = 2; g.stroke();
      g.restore();
    }
    g.restore();
  }

  private drawPanel(g: G) {
    // goal preview
    const p = this.prev;
    if (this.pic) {
      g.save(); g.translate(p.x + p.s / 2, p.y + p.s / 2); g.rotate(-0.04 + Math.sin(this.t * 1.3) * 0.015);
      clayPanel(g, -p.s / 2 - 7, -p.s / 2 - 7, p.s + 14, p.s + 20, 14, "#FFF4E2", { lip: 6 });
      g.save(); rr(g, -p.s / 2, -p.s / 2, p.s, p.s, 8); g.clip();
      g.drawImage(this.phase === "fly" ? this.picBg! : this.pic, -p.s / 2, -p.s / 2, p.s, p.s);
      g.restore();
      g.restore();
      clayText(g, "GOAL", p.x + p.s / 2, p.y - 8, clamp(p.s * 0.16, 13, 20), { fill: "#FFE38A", rot: -0.04 });
    }
    if (this.hud.status !== "playing" || !this.tiles.length) return;
    // moves / par
    const s = this.stats, fs = clamp(s.w * 0.17, 14, 22);
    rr(g, s.x - s.w / 2, s.y - 4, s.w, fs * 2.7, 14); g.fillStyle = "rgba(13,7,38,0.55)"; g.fill();
    clayText(g, `MOVES ${this.moves}`, s.x, s.y + fs * 0.7, fs, { fill: "#FFFFFF" });
    clayText(g, `PAR ${this.par}`, s.x, s.y + fs * 1.9, fs * 0.8, { fill: this.moves <= this.par ? "#7CF2C9" : "#FF8FB1" });
    if (this.fuelMax) {
      const w = Math.min(s.w, 120), x0 = s.x - w / 2, y0 = s.y + fs * 2.75, left = clamp((this.fuelMax - this.moves) / this.fuelMax, 0, 1);
      rr(g, x0, y0, w, 12, 6); g.fillStyle = "rgba(10,4,30,0.6)"; g.fill();
      if (left > 0) { rr(g, x0 + 2, y0 + 2, (w - 4) * left, 8, 4); g.fillStyle = left > 0.3 ? "#FFD25A" : "#FF6F91"; g.fill(); }
      clayText(g, `⛽ ${Math.max(0, this.fuelMax - this.moves)}`, s.x, y0 + 26, fs * 0.7, { fill: "#FFE38A", gloss: false });
    }
    if (this.canPeek) {
      const b = this.peekBtn, on = this.peekT > 0;
      g.save(); g.globalAlpha = this.phase === "play" || this.phase === "intro" ? 1 : 0.5;
      clayPanel(g, b.x, b.y, b.w, b.h, 16, on ? "#2EC4B6" : "#FFB000", { lip: 6, pressed: b.press });
      clayText(g, "123", b.x + b.w / 2, b.y + b.h * 0.4 + b.press * 4, Math.min(22, b.h * 0.38), { fill: "#FFFFFF" });
      g.font = `11px "Fredoka", system-ui, sans-serif`; g.textAlign = "center"; g.fillStyle = "rgba(35,48,90,0.85)";
      g.fillText(on ? "peeking" : "peek", b.x + b.w / 2, b.y + b.h * 0.76 + b.press * 4);
      g.restore();
    }
  }

  private drawZib(g: G) {
    const z = this.zib, mood = this.hud.status === "playing" ? this.hud.host.mood : "happy";
    if (this.phase === "fly" && this.hud.status === "playing") return; // Zib is in the saucer
    shadow(g, z.x, z.y - 4, z.h * 0.3, 8, 0.35);
    this.sprite(g, this.host(mood), z.x, z.y, z.h, { sy: 1 + z.bop * 0.08 + Math.sin(this.t * 2.6) * 0.02, sx: 1 - z.bop * 0.04, rot: Math.sin(this.t * 1.7) * 0.04 });
  }

  private drawKranky(g: G) {
    if (this.kr.x < -0.2 || this.kr.x > 1.3) return;
    const b = this.board, h = clamp(b.s * 0.32, 70, 150);
    const x = lerp(-h, this.W + h, this.kr.x), y = b.y + h * 0.5 + Math.sin(this.t * 10) * 6;
    this.sprite(g, this.kr.laugh > 0 ? KRANKY_LAUGH : KRANKY, x, y, h, { rot: Math.sin(this.t * 8) * 0.15, flip: this.kr.x > 0.6 });
  }

  private drawFly(g: G) {
    if (this.phase !== "fly") return;
    const p = this.ufoScreen(), u = this.fly.u;
    if (u < 0.45) {
      // tractor-beam glow while lifting off
      const a = Math.sin(clamp(u / 0.45, 0, 1) * Math.PI) * 0.5;
      const bg = g.createLinearGradient(0, p.y, 0, p.y + p.s * 1.6); bg.addColorStop(0, rgba("#FFF4B0", a)); bg.addColorStop(1, rgba("#FFF4B0", 0));
      g.fillStyle = bg; g.beginPath(); g.moveTo(p.x - p.s * 0.3, p.y + p.s * 0.15); g.lineTo(p.x + p.s * 0.3, p.y + p.s * 0.15); g.lineTo(p.x + p.s * 0.75, p.y + p.s * 1.6); g.lineTo(p.x - p.s * 0.75, p.y + p.s * 1.6); g.closePath(); g.fill();
    }
    drawUfo(g, p.x, p.y, p.s, this.theme, { tilt: p.tilt, blink: this.t * 8, zib: this.img(ZIB_WOW) ?? this.img(ZIB_HAPPY), wave: Math.sin(this.t * 12) * 0.22 });
    if (u > 0.08 && u < 0.75) {
      const a = Math.min(1, (u - 0.08) * 8) * Math.min(1, (0.75 - u) * 8);
      g.save(); g.globalAlpha = a;
      clayText(g, "BYE-BYE!", p.x + p.s * 0.2, p.y - p.s * 0.95, clamp(p.s * 0.32, 18, 34), { fill: "#FFFFFF", rot: -0.08 });
      g.restore();
    }
  }

  protected drawBackground(g: G) {
    if (!this.pic || !this.tiles.length) {
      this.n = 3; this.theme = THEMES[0];
      const pic = paintPicture(this.theme, new Rng(4242), this.img(ZIB_HAPPY));
      this.pic = pic.full; this.picBg = pic.bg; this.ufo = pic.ufo;
      this.cells = [0, 1, 2, 3, 8, 5, 6, 4, 7]; this.gap = 4;
      this.tiles = this.cells.map((id, pos) => ({ id, r: Math.floor(pos / 3), c: pos % 3, dr: Math.floor(pos / 3), dc: pos % 3, spd: 18, wig: 0 })).filter((t) => t.id !== 8);
      this.nums = true; this.phase = "intro";
      this.layout();
    }
    this.drawSpace(g);
    this.drawBoard(g);
    this.drawPanel(g);
    this.drawZib(g);
  }

  protected draw(g: G) {
    this.drawSpace(g);
    this.drawBoard(g);
    this.drawPanel(g);
    this.drawZib(g);
    this.drawKranky(g);
    this.drawFly(g);
  }
}
