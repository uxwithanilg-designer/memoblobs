// Drawing the course in world space (metres, y up; the camera transform is already set): the ground blocks with the
// world's material (a soft gradient, a texture, a thick rounded cap with a highlight and the shadow it casts, a bold
// outline, and the world's own edge details — stitches, icing drips, hazard stripes, grass, neon edges, snow and
// icicles, rivets, glowing moss, coral sand, brass bolts, purple grass, panel lights), the pits and what's down them
// (water, a chocolate river, a misty drop, clouds, a neon grid, icy water, oil, glowing goo, a trench, steam, slime,
// open space), and every contraption from its live physics pose: seesaws, crumbling planks that shake before they
// fall, lifts on their cables, sliding platforms on rails, launch pads that squash and spring, gates, drawbridges on
// chains, wrecking balls on cranes, crushers, rolling balls, crates, gears, wobbly bridges, belts, loops, fans,
// buttons, warning signs, checkpoint flags, the start and the finish.
import type { Course, Deco, Solid } from "../course";
import { STATIC, type Body } from "../physics";
import type { Look } from "./look";
import { makeRng, mix, rgba, shade } from "../util";

type C = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
export interface View { x0: number; x1: number; y0: number; y1: number; scale: number }

interface SolidArt { s: Solid; path: Path2D; top: Path2D | null; x0: number; x1: number; yTop: number; grad: CanvasGradient | null; extra: Path2D | null }

export class CourseArt {
  private solids: SolidArt[] = [];
  private pattern: CanvasPattern | null = null;
  private id: string;
  /** checkpoints passed (flags turn green) */
  cpPassed = 0;
  constructor(private course: Course, private L: Look) {
    this.id = L.world.id;
    for (const s of course.solids) {
      const path = new Path2D();
      for (let i = 0; i < s.pts.length; i += 2) { if (i) path.lineTo(s.pts[i], s.pts[i + 1]); else path.moveTo(s.pts[i], s.pts[i + 1]); }
      path.closePath();
      let top: Path2D | null = null, yTop = -Infinity;
      if (s.top.length >= 4) {
        top = new Path2D();
        for (let i = 0; i < s.top.length; i += 2) { if (i) top.lineTo(s.top[i], s.top[i + 1]); else top.moveTo(s.top[i], s.top[i + 1]); yTop = Math.max(yTop, s.top[i + 1]); }
      }
      if (!Number.isFinite(yTop)) { yTop = -Infinity; for (let i = 1; i < s.pts.length; i += 2) yTop = Math.max(yTop, s.pts[i]); }
      let x0 = Infinity, x1 = -Infinity;
      for (let i = 0; i < s.pts.length; i += 2) { x0 = Math.min(x0, s.pts[i]); x1 = Math.max(x1, s.pts[i]); }
      this.solids.push({ s, path, top, x0, x1, yTop, grad: null, extra: s.top.length >= 4 ? this.edgeDetail(s) : null });
    }
  }

  /** the world's texture tile, mapped to ~2.4 m */
  private ensurePattern(c: C) {
    if (this.pattern) return;
    const T = 128, cv = document.createElement("canvas"); cv.width = cv.height = T;
    const g = cv.getContext("2d")!, L = this.L, r = makeRng(L.seed + 11), id = this.id;
    const ink = rgba(shade(L.ground.body[1], -0.35), 0.22), hi = rgba(L.ground.detail, 0.25);
    g.lineWidth = 2;
    if (id === "toybox" || id === "skyisles") { // wood grain / rock strata
      for (let y = 0; y < T; y += 16) { g.strokeStyle = ink; g.beginPath(); for (let x = 0; x <= T; x += 8) g.lineTo(x, y + Math.sin((x / T) * TAU * 2 + y) * 3); g.stroke(); }
      for (let k = 0; k < 4; k++) { g.strokeStyle = hi; g.beginPath(); g.ellipse(r() * T, r() * T, 8, 4, 0, 0, TAU); g.stroke(); }
    } else if (id === "candy") { // cake layers and sprinkles
      g.fillStyle = rgba("#FFF4FA", 0.25); g.fillRect(0, 60, T, 8);
      for (let k = 0; k < 14; k++) { g.fillStyle = ["#FF6FB5", "#7CF5C8", "#FFD23F", "#7C6BFF"][k % 4]; g.save(); g.translate(r() * T, r() * T); g.rotate(r() * 3); g.fillRect(-4, -1.5, 8, 3); g.restore(); }
    } else if (id === "hardhat" || id === "orbit") { // concrete / panels
      g.strokeStyle = ink; g.strokeRect(1, 1, T - 2, T / 2 - 2); g.strokeRect(1, T / 2 + 1, T - 2, T / 2 - 2);
      for (let k = 0; k < 30; k++) { g.fillStyle = r() < 0.5 ? ink : hi; g.fillRect(r() * T, r() * T, 2, 2); }
    } else if (id === "neon") { // dark glass grid
      g.strokeStyle = rgba(L.metal.glow, 0.18); g.strokeRect(0, 0, T, T); g.beginPath(); g.moveTo(T / 2, 0); g.lineTo(T / 2, T); g.moveTo(0, T / 2); g.lineTo(T, T / 2); g.stroke();
    } else if (id === "glacier") { // cracks
      g.strokeStyle = rgba("#FFFFFF", 0.3);
      for (let k = 0; k < 5; k++) { g.beginPath(); let x = r() * T, y = r() * T; g.moveTo(x, y); for (let s = 0; s < 4; s++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
    } else if (id === "scrapyard" || id === "clockwork") { // plates and rivets
      g.strokeStyle = ink; g.strokeRect(1, 1, T / 2 - 2, T / 2 - 2); g.strokeRect(T / 2 + 1, 1, T / 2 - 2, T / 2 - 2); g.strokeRect(1, T / 2 + 1, T - 2, T / 2 - 2);
      g.fillStyle = hi; for (const [x, y] of [[6, 6], [T / 2 - 6, 6], [T / 2 + 6, 6], [T - 6, 6], [6, T / 2 + 6], [T - 6, T / 2 + 6]]) { g.beginPath(); g.arc(x, y, 2.5, 0, TAU); g.fill(); }
      if (id === "scrapyard") for (let k = 0; k < 6; k++) { g.fillStyle = rgba("#C2652A", 0.25); g.beginPath(); g.arc(r() * T, r() * T, 4 + r() * 8, 0, TAU); g.fill(); }
    } else if (id === "shroom") { // soil with glowing specks
      for (let k = 0; k < 24; k++) { g.fillStyle = k % 4 ? ink : rgba(L.metal.glow, 0.5); g.beginPath(); g.arc(r() * T, r() * T, 1.5 + r() * 2, 0, TAU); g.fill(); }
    } else if (id === "coral") { // sand with shells
      for (let k = 0; k < 40; k++) { g.fillStyle = r() < 0.5 ? ink : hi; g.fillRect(r() * T, r() * T, 2, 2); }
      for (let k = 0; k < 3; k++) { g.strokeStyle = hi; g.beginPath(); g.arc(r() * T, r() * T, 5, Math.PI, 0); g.stroke(); }
    } else { // haunted: old stones
      for (let y = 0; y < T; y += 32) for (let x = (y / 32) % 2 ? 0 : -24; x < T; x += 48) { g.strokeStyle = ink; g.strokeRect(x + 2, y + 2, 44, 28); }
    }
    this.pattern = c.createPattern(cv, "repeat");
    try { this.pattern?.setTransform(new DOMMatrix().scale(2.4 / T, 2.4 / T)); } catch { /* old browsers: unscaled */ }
  }

  /** the world's details along a solid's top edge, as one path made once */
  private edgeDetail(s: Solid) {
    const id = this.id, t = s.top, p = new Path2D(), r = makeRng(Math.round(t[0] * 13) + 7);
    const along = (fn: (x: number, y: number, nx: number, ny: number) => void, gap: number) => {
      for (let i = 0; i + 3 < t.length; i += 2) {
        const ax = t[i], ay = t[i + 1], bx = t[i + 2], by = t[i + 3], len = Math.hypot(bx - ax, by - ay);
        if (len < 1e-3 || Math.abs(by - ay) > len * 0.85) continue;
        const nx = -(by - ay) / len, ny = (bx - ax) / len;
        for (let u = (r() * gap) / len; u < 1; u += gap / len) fn(ax + (bx - ax) * u, ay + (by - ay) * u, nx, ny);
      }
    };
    if (id === "candy") along((x, y) => { const rad = 0.12 + r() * 0.16; p.moveTo(x + rad, y - 0.18); p.arc(x, y - 0.18, rad, 0, Math.PI, true); p.lineTo(x - rad, y - 0.05); p.lineTo(x + rad, y - 0.05); }, 0.7);
    else if (id === "glacier") along((x, y) => { const h = 0.2 + r() * 0.45; p.moveTo(x - 0.1, y - 0.15); p.lineTo(x, y - 0.15 - h); p.lineTo(x + 0.1, y - 0.15); }, 0.9);
    else if (id === "skyisles" || id === "haunted" || id === "toybox") along((x, y) => { for (let k = 0; k < 3; k++) { const a = -0.5 + k * 0.5, h = 0.25 + r() * 0.2; p.moveTo(x + k * 0.07 - 0.07, y + 0.12); p.lineTo(x + Math.sin(a) * h * 0.6 + k * 0.07 - 0.07, y + 0.12 + Math.cos(a) * h); p.lineTo(x + k * 0.07 - 0.03, y + 0.12); } }, 1.6);
    else if (id === "scrapyard" || id === "clockwork" || id === "orbit" || id === "hardhat") along((x, y) => { p.moveTo(x + 0.07, y - 0.32); p.arc(x, y - 0.32, 0.07, 0, TAU); }, 1.2);
    else if (id === "shroom" || id === "coral" || id === "neon") along((x, y) => { const rad = 0.05 + r() * 0.06; p.moveTo(x + rad, y - 0.25 - r() * 0.4); p.arc(x, y - 0.25 - r() * 0.4, rad, 0, TAU); }, 0.8);
    return p;
  }

  // ================================================================ pits and what's down them
  drawPits(c: C, v: View, t: number) {
    const L = this.L, liq = L.world.liquid, deep = shade(L.ground.body[1], -0.55);
    for (const pt of this.course.pits) {
      if (pt.x1 < v.x0 || pt.x0 > v.x1) continue;
      const top = pt.kill + 1.2, bottom = Math.min(top - 1, v.y0) - 4, w = pt.x1 - pt.x0;
      const open = liq === "cloud" || liq === "space" || liq === "void";
      if (!open) {
        // the pit's dark inside
        c.fillStyle = rgba(deep, 0.85); c.fillRect(pt.x0, pt.lip, w, top - pt.lip);
      }
      let col = "#3FA7F5", col2 = "#1E5BA8";
      if (liq === "choc") { col = "#7A4022"; col2 = "#3E1C0C"; }
      else if (liq === "icewater") { col = "#7CD4F2"; col2 = "#1E6FA0"; }
      else if (liq === "oil") { col = "#1A1418"; col2 = "#050405"; }
      else if (liq === "goo") { col = "#3DF5A7"; col2 = "#0E6A4A"; }
      else if (liq === "trench") { col = "#0A3A5A"; col2 = "#02101C"; }
      else if (liq === "steam") { col = "#FF9A3D"; col2 = "#5A1A08"; }
      else if (liq === "slime") { col = "#7BE33A"; col2 = "#1E5A12"; }
      else if (liq === "grid") { col = "#1A0B3D"; col2 = "#05020F"; }
      if (liq === "cloud") {
        for (let k = 0; k < Math.ceil(w / 1.6) + 1; k++) {
          const x = pt.x0 + k * 1.6 + Math.sin(t * 0.6 + k) * 0.2, y = top - 0.6 + Math.sin(k * 1.7) * 0.3;
          c.fillStyle = rgba(mix("#FFFFFF", L.haze, 0.3), 0.92); c.beginPath(); c.arc(x, y, 1.1 + (k % 3) * 0.25, 0, TAU); c.fill();
        }
        continue;
      }
      if (open) {
        const g = c.createLinearGradient(0, pt.lip, 0, pt.lip - 8);
        g.addColorStop(0, rgba(deep, 0)); g.addColorStop(1, rgba(deep, liq === "space" ? 0.5 : 0.9));
        c.fillStyle = g; c.fillRect(pt.x0, pt.lip - 8, w, 8);
        if (liq === "space") for (let k = 0; k < w * 2; k++) { c.fillStyle = rgba("#FFFFFF", 0.4 + 0.4 * Math.sin(t * 2 + k)); c.fillRect(pt.x0 + ((k * 0.73) % w), pt.lip - 2 - ((k * 1.37) % 6), 0.06, 0.06); }
        continue;
      }
      // the surface, with waves
      const g = c.createLinearGradient(0, top, 0, top - 4); g.addColorStop(0, col); g.addColorStop(1, col2);
      c.fillStyle = g;
      c.beginPath(); c.moveTo(pt.x0, bottom);
      for (let x = pt.x0; x <= pt.x1 + 0.01; x += 0.4) c.lineTo(Math.min(x, pt.x1), top + Math.sin(x * 1.6 + t * 2.2) * 0.08 + Math.sin(x * 0.7 - t * 1.3) * 0.06);
      c.lineTo(pt.x1, bottom); c.closePath(); c.fill();
      c.strokeStyle = rgba(liq === "oil" ? "#B48CFF" : "#FFFFFF", liq === "goo" || liq === "steam" ? 0.6 : 0.35); c.lineWidth = 0.07;
      c.beginPath(); for (let x = pt.x0; x <= pt.x1 + 0.01; x += 0.4) c.lineTo(Math.min(x, pt.x1), top + 0.04 + Math.sin(x * 1.6 + t * 2.2) * 0.08 + Math.sin(x * 0.7 - t * 1.3) * 0.06); c.stroke();
      if (liq === "goo" || liq === "steam" || liq === "slime") {
        // glow and bubbles
        const gl = c.createLinearGradient(0, top, 0, top + 2.5); gl.addColorStop(0, rgba(col, 0.35)); gl.addColorStop(1, rgba(col, 0));
        c.fillStyle = gl; c.fillRect(pt.x0, top, w, 2.5);
        for (let k = 0; k < w; k += 1.3) { const ph = (t * 0.7 + k * 0.37) % 1; c.fillStyle = rgba(shade(col, 0.3), 0.7 * (1 - ph)); c.beginPath(); c.arc(pt.x0 + k + 0.4, top + ph * 0.5, 0.08 + ph * 0.12, 0, TAU); c.fill(); }
      }
      if (liq === "grid") {
        c.strokeStyle = rgba("#FF3DCB", 0.6); c.lineWidth = 0.05;
        for (let x = Math.ceil(pt.x0); x < pt.x1; x++) { c.beginPath(); c.moveTo(x, top); c.lineTo(x, bottom); c.stroke(); }
        for (let y = top - 0.5; y > top - 4; y -= 0.6) { c.beginPath(); c.moveTo(pt.x0, y); c.lineTo(pt.x1, y); c.stroke(); }
      }
    }
  }

  // ================================================================ ground
  drawGround(c: C, v: View, t: number) {
    this.ensurePattern(c);
    const L = this.L, gr = L.ground, id = this.id;
    for (const sa of this.solids) {
      if (sa.x1 < v.x0 - 1 || sa.x0 > v.x1 + 1) continue;
      const s = sa.s;
      if (!sa.grad) {
        const y = sa.yTop;
        sa.grad = c.createLinearGradient(0, y, 0, y - 9);
        if (s.kind === "ceiling") { sa.grad.addColorStop(0, shade(gr.body[1], -0.1)); sa.grad.addColorStop(1, shade(gr.body[0], 0.05)); }
        else if (s.kind === "ice") { sa.grad.addColorStop(0, "#DFF6FF"); sa.grad.addColorStop(1, "#5FB4DE"); }
        else if (s.kind === "belt") { sa.grad.addColorStop(0, shade(L.metal.dark, 0.1)); sa.grad.addColorStop(1, shade(L.metal.dark, -0.3)); }
        else { sa.grad.addColorStop(0, gr.body[0]); sa.grad.addColorStop(1, gr.body[1]); }
      }
      c.fillStyle = sa.grad; c.fill(sa.path);
      if (this.pattern && s.kind !== "ice") { c.globalAlpha = 0.9; c.fillStyle = this.pattern; c.fill(sa.path); c.globalAlpha = 1; }
      // the shade a cap casts on the block below it
      if (sa.top) {
        c.save(); c.clip(sa.path);
        c.translate(0, -0.42); c.strokeStyle = rgba("#000000", 0.2); c.lineWidth = 1.2; c.lineJoin = "round"; c.stroke(sa.top);
        c.restore();
      }
      c.strokeStyle = gr.edge; c.lineWidth = 0.07; c.lineJoin = "round"; c.stroke(sa.path);
      if (s.kind === "ceiling") {
        c.save(); c.clip(sa.path);
        c.strokeStyle = rgba(L.metal.hazard[0], 0.85); c.lineWidth = 0.18; c.stroke(sa.path);
        c.restore();
        continue;
      }
      if (!sa.top) continue;
      c.lineCap = "round"; c.lineJoin = "round";
      if (s.kind === "belt") {
        // the belt: dark rubber with chevrons running the way the belt goes
        c.strokeStyle = "#1E1E26"; c.lineWidth = 0.4; c.stroke(sa.top);
        c.save(); c.setLineDash([0.35, 0.35]); c.lineDashOffset = (t * (s.belt ?? 0)) % 0.7; c.strokeStyle = rgba(L.metal.hazard[0], 0.85); c.lineWidth = 0.16; c.stroke(sa.top); c.restore();
        continue;
      }
      const capW = s.kind === "ice" ? 0.28 : 0.42;
      c.strokeStyle = s.kind === "ice" ? "#FFFFFF" : gr.cap; c.lineWidth = capW; c.stroke(sa.top);
      c.save(); c.translate(0, 0.1); c.strokeStyle = rgba(s.kind === "ice" ? "#FFFFFF" : shade(gr.cap, 0.35), 0.8); c.lineWidth = 0.1; c.stroke(sa.top); c.restore();
      if (id === "hardhat") { c.save(); c.translate(0, -0.25); c.setLineDash([0.4, 0.4]); c.strokeStyle = gr.cap2; c.lineWidth = 0.16; c.stroke(sa.top); c.restore(); }
      if (id === "toybox") { c.save(); c.translate(0, -0.05); c.setLineDash([0.18, 0.14]); c.strokeStyle = rgba("#FFFFFF", 0.7); c.lineWidth = 0.035; c.stroke(sa.top); c.restore(); }
      if (id === "neon") { c.globalAlpha = 0.35; c.strokeStyle = gr.cap; c.lineWidth = 0.9; c.stroke(sa.top); c.globalAlpha = 1; }
      if (sa.extra) {
        c.fillStyle = id === "candy" ? gr.cap : id === "glacier" ? "#E8F8FF" : id === "shroom" || id === "neon" || id === "coral" ? rgba(id === "coral" ? "#FFF4E0" : L.metal.glow, id === "coral" ? 0.6 : 0.85) : id === "skyisles" || id === "toybox" ? shade(gr.cap, -0.12) : id === "haunted" ? shade(gr.cap, 0.15) : rgba(gr.detail, 0.9);
        c.fill(sa.extra);
      }
    }
    c.lineCap = "butt";
  }

  // ================================================================ decos behind the bodies
  drawDecosBack(c: C, v: View, t: number) {
    for (const d of this.course.decos) {
      if (d.x + (d.w || 0) + 6 < v.x0 || d.x - 6 > v.x1) continue;
      switch (d.k) {
        case "shaft": this.shaft(c, d); break;
        case "crane": this.crane(c, d); break;
        case "frame": this.frame(c, d); break;
        case "pillar": this.pillar(c, d); break;
        case "housing": this.housing(c, d, false); break;
        case "fans": this.fans(c, d, t); break;
        case "loop": this.loop(c, d, false); break;
        case "start": this.arch(c, d, false, t); break;
        case "finish": this.arch(c, d, true, t); break;
      }
    }
  }
  /** decos in front of the car */
  drawDecosFront(c: C, v: View, t: number) {
    let cp = 0;
    for (const d of this.course.decos) {
      if (d.k === "checkpoint") cp++;
      if (d.x + (d.w || 0) + 6 < v.x0 || d.x - 6 > v.x1) continue;
      switch (d.k) {
        case "button": this.button(c, d); break;
        case "sign": this.sign(c, d); break;
        case "posts": this.posts(c, d); break;
        case "hinge": this.hinge(c, d); break;
        case "checkpoint": this.flag(c, d, cp <= this.cpPassed, t); break;
        case "housing": this.housing(c, d, true); break;
        case "loop": this.loop(c, d, true); break;
      }
    }
  }

  private metalBar(c: C, x0: number, y0: number, x1: number, y1: number, w: number) {
    const M = this.L.metal;
    c.lineCap = "round"; c.strokeStyle = M.dark; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    c.strokeStyle = M.main; c.lineWidth = w * 0.62; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    c.strokeStyle = rgba(M.light, 0.7); c.lineWidth = w * 0.18; c.beginPath(); c.moveTo(x0 - w * 0.12, y0 + w * 0.12); c.lineTo(x1 - w * 0.12, y1 + w * 0.12); c.stroke();
    c.lineCap = "butt";
  }
  private shaft(c: C, d: Deco) {
    const M = this.L.metal, top = d.y + d.h + 2.2;
    this.metalBar(c, d.x + 0.12, d.y - 3, d.x + 0.12, top, 0.22);
    this.metalBar(c, d.x + d.w - 0.12, d.y - 3, d.x + d.w - 0.12, top, 0.22);
    this.metalBar(c, d.x - 0.2, top, d.x + d.w + 0.2, top, 0.36);
    c.fillStyle = M.dark; c.beginPath(); c.arc(d.x + d.w / 2, top - 0.3, 0.38, 0, TAU); c.fill();
    c.fillStyle = M.light; c.beginPath(); c.arc(d.x + d.w / 2, top - 0.3, 0.14, 0, TAU); c.fill();
  }
  private crane(c: C, d: Deco) {
    const M = this.L.metal, ax = d.x, ay = d.y + d.h;
    const mx = ax - d.w * 0.95 - 1.5;
    this.metalBar(c, mx, d.y - 0.2, mx, ay + 0.8, 0.42);
    c.strokeStyle = M.dark; c.lineWidth = 0.06;
    for (let y = d.y; y < ay; y += 0.8) { c.beginPath(); c.moveTo(mx - 0.18, y); c.lineTo(mx + 0.18, y + 0.8); c.stroke(); }
    this.metalBar(c, mx - 1.2, ay + 0.6, ax + 0.6, ay + 0.6, 0.34);
    c.fillStyle = M.dark; c.fillRect(mx - 1.6, ay + 0.2, 0.9, 0.8);
    c.fillStyle = M.dark; c.beginPath(); c.arc(ax, ay, 0.26, 0, TAU); c.fill();
  }
  private frame(c: C, d: Deco) {
    this.metalBar(c, d.x, d.y - 0.2, d.x, d.y + d.h, 0.34);
    this.metalBar(c, d.x + d.w, d.y - 0.2, d.x + d.w, d.y + d.h, 0.34);
    this.metalBar(c, d.x - 0.3, d.y + d.h, d.x + d.w + 0.3, d.y + d.h, 0.6);
  }
  private pillar(c: C, d: Deco) {
    const M = this.L.metal;
    c.fillStyle = M.dark; c.fillRect(d.x - d.w / 2, d.y - d.h, d.w, d.h);
    c.fillStyle = M.main; c.fillRect(d.x - d.w / 2 + 0.06, d.y - d.h, d.w * 0.5, d.h);
    c.fillStyle = M.dark; c.beginPath(); c.moveTo(d.x - 0.5, d.y - 0.6); c.lineTo(d.x, d.y + 0.05); c.lineTo(d.x + 0.5, d.y - 0.6); c.fill();
    c.fillStyle = M.light; c.beginPath(); c.arc(d.x, d.y, 0.14, 0, TAU); c.fill();
  }
  private housing(c: C, d: Deco, front: boolean) {
    const M = this.L.metal, x = d.x;
    if (!front) {
      this.metalBar(c, x - 0.62, d.y, x - 0.62, d.y + d.h, 0.26);
      this.metalBar(c, x + 0.62, d.y, x + 0.62, d.y + d.h, 0.26);
      return;
    }
    c.fillStyle = M.dark; c.fillRect(x - 0.95, d.y + 4.3, 1.9, d.h - 4.3);
    c.fillStyle = M.main; c.fillRect(x - 0.85, d.y + 4.4, 1.7, d.h - 4.5);
    c.fillStyle = M.hazard[0]; for (let y = d.y + 4.6; y < d.y + d.h - 0.3; y += 0.8) c.fillRect(x - 0.85, y, 1.7, 0.18);
  }
  private fans(c: C, d: Deco, t: number) {
    const M = this.L.metal;
    for (let x = d.x + 1.2; x < d.x + d.w - 0.8; x += 2.4) {
      c.fillStyle = M.dark; c.fillRect(x - 0.95, d.y - 0.6, 1.9, 0.8);
      c.save(); c.translate(x, d.y + 0.25); c.scale(1, 0.32);
      c.fillStyle = M.main; c.beginPath(); c.arc(0, 0, 0.9, 0, TAU); c.fill();
      c.fillStyle = M.light;
      for (let k = 0; k < 4; k++) { const a = t * 14 + (k * TAU) / 4; c.beginPath(); c.ellipse(Math.cos(a) * 0.45, Math.sin(a) * 0.45, 0.42, 0.14, a, 0, TAU); c.fill(); }
      c.restore();
      // the wind going up
      for (let k = 0; k < 4; k++) {
        const ph = (t * 1.3 + k * 0.25 + x * 0.1) % 1;
        c.strokeStyle = rgba("#FFFFFF", 0.35 * (1 - ph)); c.lineWidth = 0.05;
        const wx = x + Math.sin(k * 2.1 + x) * 0.6, wy = d.y + 0.5 + ph * d.h;
        c.beginPath(); c.moveTo(wx, wy); c.lineTo(wx + Math.sin(ph * 6 + k) * 0.15, wy + 0.9); c.stroke();
      }
    }
  }
  private loop(c: C, d: Deco, front: boolean) {
    const M = this.L.metal;
    if (!front) {
      // the track band of the loop
      c.strokeStyle = M.dark; c.lineWidth = 0.55; c.beginPath(); c.arc(d.x, d.y, d.w + 0.27, 0, TAU); c.stroke();
      c.strokeStyle = M.main; c.lineWidth = 0.32; c.beginPath(); c.arc(d.x, d.y, d.w + 0.22, 0, TAU); c.stroke();
      c.save(); c.setLineDash([0.4, 0.4]); c.strokeStyle = M.hazard[0]; c.lineWidth = 0.12; c.beginPath(); c.arc(d.x, d.y, d.w + 0.4, 0, TAU); c.stroke(); c.restore();
      this.metalBar(c, d.x - d.w * 0.7, d.y - d.w, d.x - d.w * 0.3, d.y - d.w * 0.2, 0.2);
      this.metalBar(c, d.x + d.w * 0.7, d.y - d.w, d.x + d.w * 0.3, d.y - d.w * 0.2, 0.2);
    } else {
      // the near rail over the car's lower half, for depth
      c.strokeStyle = rgba(M.light, 0.55); c.lineWidth = 0.08; c.beginPath(); c.arc(d.x, d.y, d.w + 0.05, Math.PI * 0.05, Math.PI * 0.95); c.stroke();
    }
  }
  private button(c: C, d: Deco) {
    const pressed = this.course.physics.buttons[d.a]?.pressed;
    c.fillStyle = this.L.metal.dark; c.fillRect(d.x - d.w / 2 - 0.1, d.y - 0.04, d.w + 0.2, 0.12);
    c.fillStyle = pressed ? "#3EE08F" : "#FF4F5A"; c.fillRect(d.x - d.w / 2, d.y + (pressed ? 0 : 0.05), d.w, pressed ? 0.06 : 0.14);
    c.fillStyle = rgba("#FFFFFF", 0.5); c.fillRect(d.x - d.w / 2 + 0.1, d.y + (pressed ? 0.04 : 0.15), d.w - 0.2, 0.03);
  }
  private sign(c: C, d: Deco) {
    if (!Number.isFinite(d.y)) return;
    const M = this.L.metal;
    c.fillStyle = M.dark; c.fillRect(d.x - 0.05, d.y, 0.1, 1.5);
    c.save(); c.translate(d.x, d.y + 1.9);
    c.fillStyle = "#FFC233"; c.strokeStyle = "#2A2A2A"; c.lineWidth = 0.06;
    c.beginPath(); c.moveTo(0, 0.5); c.lineTo(0.5, -0.36); c.lineTo(-0.5, -0.36); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = "#2A2A2A";
    if (d.a === 1) { c.beginPath(); c.moveTo(-0.28, -0.24); c.lineTo(0.24, -0.24); c.lineTo(0.24, 0.12); c.closePath(); c.fill(); }
    else { c.fillRect(-0.04, -0.12, 0.08, 0.36); c.beginPath(); c.arc(0, -0.22, 0.05, 0, TAU); c.fill(); }
    c.restore();
  }
  private posts(c: C, d: Deco) {
    const M = this.L.metal, wood = mix("#9A6A3A", this.L.layers[3], 0.25);
    for (const x of [d.x - 0.15, d.x + d.w + 0.15]) { c.fillStyle = wood; c.fillRect(x - 0.12, d.y, 0.24, d.h + 0.2); c.fillStyle = M.dark; c.beginPath(); c.arc(x, d.y + d.h + 0.2, 0.15, 0, TAU); c.fill(); }
    c.strokeStyle = mix("#C8A070", this.L.layers[3], 0.2); c.lineWidth = 0.05;
    c.beginPath(); c.moveTo(d.x - 0.15, d.y + d.h); c.quadraticCurveTo(d.x + d.w / 2, d.y + d.h - 0.9, d.x + d.w + 0.15, d.y + d.h); c.stroke();
  }
  private hinge(c: C, d: Deco) {
    const M = this.L.metal;
    this.metalBar(c, d.x + 0.35, d.y, d.x + 0.35, d.y + d.h * 0.55 + 1, 0.3);
    const b = this.course.physics.bodies.find((q) => q.tag === "bridge" && Math.abs(q.x - d.x) < 0.01);
    if (b) {
      const len = b.d.len ?? d.h, tipX = b.x + Math.cos(b.a + Math.PI) * len, tipY = b.y + Math.sin(b.a + Math.PI) * len;
      c.strokeStyle = M.dark; c.lineWidth = 0.06; c.setLineDash([0.12, 0.08]);
      c.beginPath(); c.moveTo(d.x + 0.35, d.y + d.h * 0.55 + 0.9); c.lineTo(tipX, tipY); c.stroke(); c.setLineDash([]);
    }
  }
  private flag(c: C, d: Deco, passed: boolean, t: number) {
    c.fillStyle = "#E8ECF5"; c.fillRect(d.x - 0.06, d.y, 0.12, 3.2);
    c.fillStyle = passed ? "#3EE08F" : "#FFC233";
    c.beginPath(); c.moveTo(d.x + 0.06, d.y + 3.15);
    for (let k = 0; k <= 6; k++) c.lineTo(d.x + 0.06 + k * 0.22, d.y + 3.15 - 0.05 * k + Math.sin(t * 6 + k) * 0.08);
    for (let k = 6; k >= 0; k--) c.lineTo(d.x + 0.06 + k * 0.22, d.y + 2.35 - 0.05 * k + Math.sin(t * 6 + k) * 0.08);
    c.fill();
    c.fillStyle = "#FFFFFF"; c.beginPath(); c.arc(d.x, d.y + 3.25, 0.12, 0, TAU); c.fill();
  }
  private arch(c: C, d: Deco, finish: boolean, t: number) {
    const M = this.L.metal, h = 4.6, x = d.x;
    this.metalBar(c, x - 0.3, d.y, x - 0.3, d.y + h, 0.3);
    if (finish) {
      // a checkered banner on two poles
      this.metalBar(c, x + 2.6, d.y, x + 2.6, d.y + h, 0.3);
      c.save(); c.beginPath(); c.rect(x - 0.3, d.y + h - 1.1, 2.9, 1.1); c.clip();
      for (let i = 0; i < 12; i++) for (let j = 0; j < 4; j++) { c.fillStyle = (i + j) % 2 ? "#16161D" : "#F4F4F8"; c.fillRect(x - 0.3 + i * 0.26, d.y + h - 1.1 + j * 0.28 + Math.sin(t * 3 + i * 0.5) * 0.04, 0.26, 0.28); }
      c.restore();
      // the finish line on the ground
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { c.fillStyle = (i + j) % 2 ? "#16161D" : "#F4F4F8"; c.fillRect(x - 0.3 + i * 0.25, d.y - 0.02 + j * 0.12, 0.25, 0.12); }
    } else {
      // the start pole with lights
      c.fillStyle = M.dark; c.fillRect(x - 0.55, d.y + h - 1.6, 0.5, 1.4);
      for (let k = 0; k < 3; k++) { c.fillStyle = k === 2 ? "#3EE08F" : "#FF4F5A"; c.beginPath(); c.arc(x - 0.3, d.y + h - 0.45 - k * 0.42, 0.14, 0, TAU); c.fill(); }
    }
  }

  // ================================================================ contraptions
  drawBodies(c: C, v: View, t: number) {
    const W = this.course.physics;
    for (const b of W.bodies) {
      if (b.id === 0 || !b.on || !b.tag) continue;
      if (b.x + b.bound + 1 < v.x0 || b.x - b.bound - 1 > v.x1) continue;
      c.save(); c.translate(b.x, b.y); c.rotate(b.a);
      switch (b.tag) {
        case "seesaw": case "tilt": this.plank(c, b, b.d.len ?? 8, b.tag === "tilt" ? 0.28 : b.d.th ?? 0.24, true); break;
        case "plank": this.collapsePlank(c, b, t, W.t); break;
        case "lift": case "slider": this.platform(c, b, t); break;
        case "pad": this.pad(c, b, W.t); break;
        case "gate": this.gate(c, b); break;
        case "bridge": c.translate(-(b.d.len ?? 5) / 2 + 0.1, -0.18); this.plank(c, b, b.d.len ?? 5, 0.36, false); break;
        case "wrecker": this.wrecker(c, b); break;
        case "stamper": this.stamper(c, b); break;
        case "ball": this.ball(c, b); break;
        case "crate": this.crate(c, b); break;
        case "gear": this.gearBody(c, b); break;
        case "trapdoor": this.trapdoor(c, b, W.t); break;
        case "roller": this.roller(c, b); break;
      }
      c.restore();
    }
  }

  private plank(c: C, b: Body, len: number, th: number, pivot: boolean) {
    const M = this.L.metal, id = this.id;
    const wood = id === "candy" ? "#F2C27A" : id === "glacier" ? "#CFEFFF" : id === "neon" ? M.main : id === "orbit" || id === "hardhat" ? M.main : mix("#B07A44", this.L.layers[3], 0.15);
    c.fillStyle = shade(wood, -0.35); c.fillRect(-len / 2, -th / 2 - 0.04, len, th + 0.08);
    c.fillStyle = wood; c.fillRect(-len / 2 + 0.04, -th / 2, len - 0.08, th);
    c.fillStyle = rgba("#FFFFFF", 0.25); c.fillRect(-len / 2 + 0.04, th / 2 - 0.07, len - 0.08, 0.05);
    c.strokeStyle = rgba(shade(wood, -0.4), 0.6); c.lineWidth = 0.03;
    for (let x = -len / 2 + 0.9; x < len / 2; x += 0.9) { c.beginPath(); c.moveTo(x, -th / 2); c.lineTo(x, th / 2); c.stroke(); }
    c.fillStyle = M.hazard[0];
    c.fillRect(-len / 2 + 0.04, -th / 2, 0.3, th); c.fillRect(len / 2 - 0.34, -th / 2, 0.3, th);
    if (pivot) { c.fillStyle = M.dark; c.beginPath(); c.arc(0, 0, 0.2, 0, TAU); c.fill(); c.fillStyle = M.light; c.beginPath(); c.arc(0, 0, 0.08, 0, TAU); c.fill(); }
    void b;
  }
  private collapsePlank(c: C, b: Body, t: number, now: number) {
    const w = b.d.w ?? 1.8, th = b.d.th ?? 0.3, id = this.id;
    // shaking just before it drops
    if (b.trig >= 0 && now - b.trig < (b.motion?.period ?? 0.5)) c.translate(Math.sin(t * 70) * 0.03, Math.sin(t * 55) * 0.02);
    const base = id === "candy" ? "#E8B46A" : id === "glacier" ? "#BFEFFF" : id === "skyisles" ? "#E8DCC0" : id === "haunted" ? "#6A5A60" : id === "neon" ? "#3A2A6A" : "#A8743E";
    c.fillStyle = shade(base, -0.4); c.fillRect(-w / 2, -th / 2, w, th);
    c.fillStyle = base; c.fillRect(-w / 2 + 0.03, -th / 2 + 0.03, w - 0.06, th - 0.06);
    c.fillStyle = rgba("#FFFFFF", 0.22); c.fillRect(-w / 2 + 0.03, th / 2 - 0.08, w - 0.06, 0.05);
    if (id === "candy") { c.strokeStyle = rgba(shade(base, -0.3), 0.6); c.lineWidth = 0.025; for (let x = -w / 2 + 0.2; x < w / 2; x += 0.25) { c.beginPath(); c.moveTo(x, -th / 2); c.lineTo(x, th / 2); c.stroke(); } }
    else if (id === "glacier") { c.strokeStyle = rgba("#FFFFFF", 0.6); c.lineWidth = 0.03; c.beginPath(); c.moveTo(-w * 0.3, th / 2); c.lineTo(-w * 0.1, 0); c.lineTo(w * 0.2, -th / 3); c.stroke(); }
    else { c.fillStyle = rgba("#2A2A2A", 0.6); for (const x of [-w / 2 + 0.14, w / 2 - 0.14]) { c.beginPath(); c.arc(x, 0, 0.04, 0, TAU); c.fill(); } }
  }
  private platform(c: C, b: Body, t: number) {
    const M = this.L.metal, w = b.d.w ?? 4;
    if (b.tag === "lift") {
      // cables to the pulley above
      c.strokeStyle = M.dark; c.lineWidth = 0.05;
      c.beginPath(); c.moveTo(-w / 2 + 0.3, 0.25); c.lineTo(-w / 2 + 0.3, 40); c.moveTo(w / 2 - 0.3, 0.25); c.lineTo(w / 2 - 0.3, 40); c.stroke();
    } else {
      // rollers under a sliding platform
      for (const x of [-w / 2 + 0.6, w / 2 - 0.6]) { c.fillStyle = M.dark; c.beginPath(); c.arc(x, -0.35, 0.2, 0, TAU); c.fill(); c.fillStyle = M.light; c.beginPath(); c.arc(x, -0.35, 0.07, 0, TAU); c.fill(); }
      const glow = 0.4 + 0.25 * Math.sin(t * 6);
      c.fillStyle = rgba(this.L.glow, glow); c.fillRect(-w / 2 + 1, -0.42, w - 2, 0.08);
    }
    c.fillStyle = M.dark; c.fillRect(-w / 2, -0.25, w, 0.5);
    c.fillStyle = M.main; c.fillRect(-w / 2 + 0.05, -0.2, w - 0.1, 0.4);
    c.save(); c.beginPath(); c.rect(-w / 2 + 0.05, 0.02, w - 0.1, 0.18); c.clip();
    c.fillStyle = M.hazard[1];
    for (let x = -w / 2 - 0.4; x < w / 2; x += 0.5) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 0.25, 0); c.lineTo(x + 0.45, 0.25); c.lineTo(x + 0.2, 0.25); c.fill(); }
    c.restore();
    c.fillStyle = rgba(M.light, 0.8); c.fillRect(-w / 2 + 0.05, 0.18, w - 0.1, 0.04);
  }
  private pad(c: C, b: Body, now: number) {
    const M = this.L.metal, w = b.d.w ?? 2.5;
    const since = now - (b.d.fired ?? -9);
    const ext = since < 0.25 ? Math.sin((since / 0.25) * Math.PI) * 0.9 : 0;
    c.fillStyle = M.dark; c.fillRect(-w / 2, -0.25, w, 0.3);
    // the springs
    c.strokeStyle = M.light; c.lineWidth = 0.06;
    for (const x of [-w / 3, 0, w / 3]) { c.beginPath(); for (let k = 0; k <= 8; k++) c.lineTo(x + (k % 2 ? 0.16 : -0.16), 0.05 + (k / 8) * (0.15 + ext)); c.stroke(); }
    c.fillStyle = "#FF4F7A"; c.fillRect(-w / 2 + 0.05, 0.18 + ext, w - 0.1, 0.1);
    c.fillStyle = rgba("#FFFFFF", 0.5); c.fillRect(-w / 2 + 0.1, 0.25 + ext, w - 0.2, 0.03);
    c.fillStyle = rgba("#FFFFFF", 0.8);
    for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(-0.25 + k * 0.25 - 0.08, 0.32 + ext); c.lineTo(-0.25 + k * 0.25, 0.42 + ext); c.lineTo(-0.25 + k * 0.25 + 0.08, 0.32 + ext); c.fill(); }
  }
  private gate(c: C, b: Body) {
    const M = this.L.metal, h = b.d.h ?? 3.9;
    c.fillStyle = M.dark; c.fillRect(-0.34, 0, 0.68, h);
    c.save(); c.beginPath(); c.rect(-0.28, 0.06, 0.56, h - 0.12); c.clip();
    for (let y = -0.6; y < h; y += 0.6) { c.fillStyle = M.hazard[0]; c.beginPath(); c.moveTo(-0.3, y); c.lineTo(0.3, y + 0.35); c.lineTo(0.3, y + 0.65); c.lineTo(-0.3, y + 0.3); c.fill(); c.fillStyle = M.hazard[1]; c.beginPath(); c.moveTo(-0.3, y + 0.3); c.lineTo(0.3, y + 0.65); c.lineTo(0.3, y + 0.95); c.lineTo(-0.3, y + 0.6); c.fill(); }
    c.restore();
    c.fillStyle = rgba("#FFFFFF", 0.25); c.fillRect(-0.28, 0.06, 0.08, h - 0.12);
  }
  private wrecker(c: C, b: Body) {
    const M = this.L.metal, len = b.d.len ?? 6, r = b.d.r ?? 1;
    c.strokeStyle = M.dark; c.lineWidth = 0.09;
    c.setLineDash([0.16, 0.08]); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -len + r * 0.9); c.stroke(); c.setLineDash([]);
    const g = c.createRadialGradient(-r * 0.35, -len + r * 0.35, r * 0.1, 0, -len, r);
    g.addColorStop(0, shade(M.light, 0.2)); g.addColorStop(0.45, this.id === "haunted" ? "#3A2A3A" : "#4A4E5C"); g.addColorStop(1, "#16161D");
    c.fillStyle = g; c.beginPath(); c.arc(0, -len, r, 0, TAU); c.fill();
    c.fillStyle = M.dark; c.fillRect(-0.18, -len + r - 0.05, 0.36, 0.3);
    if (this.id === "haunted") { c.fillStyle = rgba(this.L.glow, 0.9); c.beginPath(); c.arc(-r * 0.3, -len + r * 0.1, r * 0.13, 0, TAU); c.arc(r * 0.3, -len + r * 0.1, r * 0.13, 0, TAU); c.fill(); }
  }
  private stamper(c: C, b: Body) {
    const M = this.L.metal, w = b.d.w ?? 2.2, h = b.d.h ?? 2.4;
    this.metalBar(c, 0, h, 0, h + 9, 0.34);
    c.fillStyle = M.dark; c.fillRect(-w / 2, 0, w, h);
    c.fillStyle = M.main; c.fillRect(-w / 2 + 0.08, 0.5, w - 0.16, h - 0.58);
    c.save(); c.beginPath(); c.rect(-w / 2 + 0.05, 0.05, w - 0.1, 0.4); c.clip();
    for (let x = -w / 2 - 0.5; x < w / 2; x += 0.5) { c.fillStyle = M.hazard[0]; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 0.25, 0); c.lineTo(x + 0.6, 0.5); c.lineTo(x + 0.35, 0.5); c.fill(); }
    c.restore();
    c.fillStyle = rgba(M.light, 0.6); c.fillRect(-w / 2 + 0.08, h - 0.2, w - 0.16, 0.08);
    c.fillStyle = M.dark; for (const x of [-w / 2 + 0.3, w / 2 - 0.3]) { c.beginPath(); c.arc(x, h - 0.45, 0.09, 0, TAU); c.fill(); }
  }
  private ball(c: C, b: Body) {
    const r = b.r, id = this.id, hue = b.d.hue ?? 0;
    const pal = id === "candy" ? ["#FF6FB5", "#7CF5C8", "#FFD23F", "#7C6BFF", "#FF8A3D"] : id === "scrapyard" ? ["#2A2626", "#2A2626", "#3E7CB1", "#2A2626", "#C0392B"]
      : id === "coral" ? ["#FFB46B", "#FF7A8A", "#5EE0C8", "#FFE14D", "#B07CFF"] : id === "glacier" ? ["#F4FBFF", "#E0F4FF", "#F4FBFF", "#D4EEFF", "#F4FBFF"] : ["#FF6B6B", "#FFC93C", "#4D96FF", "#6BCB77", "#B983FF"];
    const col = mix(pal[hue % 5], this.L.layers[2], 0.1 + this.L.night * 0.25);
    if (id === "scrapyard" && hue % 5 !== 2 && hue % 5 !== 4) {
      // a tyre
      c.fillStyle = "#1E1C1E"; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
      c.strokeStyle = "#3A3638"; c.lineWidth = r * 0.16; for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU; c.beginPath(); c.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8); c.lineTo(Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98); c.stroke(); }
      c.fillStyle = "#8A8A92"; c.beginPath(); c.arc(0, 0, r * 0.42, 0, TAU); c.fill();
      c.fillStyle = "#4A4A52"; c.beginPath(); c.arc(0, 0, r * 0.18, 0, TAU); c.fill();
      return;
    }
    const g = c.createRadialGradient(-r * 0.35, r * 0.35, r * 0.05, 0, 0, r);
    g.addColorStop(0, shade(col, 0.45)); g.addColorStop(0.55, col); g.addColorStop(1, shade(col, -0.3));
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    c.strokeStyle = rgba(shade(col, -0.45), 0.5); c.lineWidth = r * 0.08; c.beginPath(); c.arc(0, 0, r * 0.62, 0.3, 1.6); c.stroke();
    c.fillStyle = rgba("#FFFFFF", 0.55); c.beginPath(); c.ellipse(-r * 0.32, r * 0.38, r * 0.2, r * 0.12, 0.6, 0, TAU); c.fill();
  }
  private crate(c: C, b: Body) {
    const cols = b.d.cols ?? 1, rows = b.d.rows ?? 2, cs = b.d.cs ?? 1.15, id = this.id;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const x = -(cols * cs) / 2 + i * cs, y = j * cs;
      if (id === "toybox") {
        const col = ["#FF6B6B", "#FFC93C", "#4D96FF", "#6BCB77"][(i + j) % 4];
        c.fillStyle = shade(col, -0.3); c.fillRect(x, y, cs, cs);
        c.fillStyle = col; c.fillRect(x + 0.05, y + 0.05, cs - 0.1, cs - 0.1);
        c.fillStyle = rgba("#FFFFFF", 0.85); c.save(); c.translate(x + cs / 2, y + cs / 2); c.scale(cs / 100, -cs / 100); c.font = "bold 62px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("ABCDEF"[(i * 2 + j) % 6], 0, 4); c.restore();
      } else {
        const wood = id === "candy" ? "#E86A9A" : id === "neon" ? "#3A2A6A" : id === "glacier" ? "#9CDCF5" : "#C08A4E";
        c.fillStyle = shade(wood, -0.35); c.fillRect(x, y, cs, cs);
        c.fillStyle = wood; c.fillRect(x + 0.07, y + 0.07, cs - 0.14, cs - 0.14);
        c.strokeStyle = shade(wood, -0.3); c.lineWidth = 0.1; c.beginPath(); c.moveTo(x + 0.1, y + 0.1); c.lineTo(x + cs - 0.1, y + cs - 0.1); c.moveTo(x + cs - 0.1, y + 0.1); c.lineTo(x + 0.1, y + cs - 0.1); c.stroke();
        c.strokeStyle = rgba("#FFFFFF", 0.25); c.lineWidth = 0.04; c.strokeRect(x + 0.1, y + 0.1, cs - 0.2, cs - 0.2);
      }
    }
    void STATIC;
  }
  private trapdoor(c: C, b: Body, now: number) {
    const M = this.L.metal, w = b.d.w ?? 2.5, open = Math.abs(b.a - b.a0);
    // the panel: a riveted plate with warning stripes on its edge, the hinge pin at its root
    c.fillStyle = M.dark; c.fillRect(0, -0.3, w, 0.3);
    c.fillStyle = M.main; c.fillRect(0.04, -0.26, w - 0.08, 0.22);
    c.save(); c.beginPath(); c.rect(w - 0.55, -0.3, 0.55, 0.3); c.clip();
    c.fillStyle = M.hazard[0]; c.fillRect(w - 0.55, -0.3, 0.55, 0.3);
    c.fillStyle = M.hazard[1]; for (let x = w - 0.7; x < w; x += 0.22) { c.beginPath(); c.moveTo(x, -0.3); c.lineTo(x + 0.11, -0.3); c.lineTo(x + 0.25, 0); c.lineTo(x + 0.14, 0); c.fill(); }
    c.restore();
    c.fillStyle = rgba(M.light, 0.7); c.fillRect(0.04, -0.05, w - 0.08, 0.04);
    c.fillStyle = M.dark; for (let x = 0.35; x < w - 0.6; x += 0.55) { c.beginPath(); c.arc(x, -0.15, 0.035, 0, TAU); c.fill(); }
    c.fillStyle = M.light; c.beginPath(); c.arc(0, -0.15, 0.12, 0, TAU); c.fill();
    c.fillStyle = M.dark; c.beginPath(); c.arc(0, -0.15, 0.05, 0, TAU); c.fill();
    // a warning lamp blinks while it's about to drop or hanging open
    const warn = open > 0.05 || (b.motion && this.course.physics.phaseOf(b, now) > (b.motion.hold ?? 0.4) - 0.06 && this.course.physics.phaseOf(b, now) < 0.6);
    if (warn && Math.sin(now * 18) > 0) { c.fillStyle = rgba("#FF4F5A", 0.9); c.beginPath(); c.arc(w * 0.5, 0.02, 0.07, 0, TAU); c.fill(); }
  }
  private roller(c: C, b: Body) {
    const M = this.L.metal, r = b.d.r ?? 0.5;
    const g = c.createRadialGradient(-r * 0.3, r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, shade(M.light, 0.1)); g.addColorStop(0.6, M.main); g.addColorStop(1, M.dark);
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    c.strokeStyle = M.dark; c.lineWidth = 0.05; c.stroke();
    // spokes and a stripe show the spin
    c.strokeStyle = rgba(M.dark, 0.7); c.lineWidth = 0.06;
    for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU; c.beginPath(); c.moveTo(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2); c.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8); c.stroke(); }
    c.fillStyle = M.hazard[0]; c.beginPath(); c.arc(0, 0, r * 0.92, -0.25, 0.25); c.arc(0, 0, r * 0.72, 0.25, -0.25, true); c.closePath(); c.fill();
    c.fillStyle = M.light; c.beginPath(); c.arc(0, 0, r * 0.18, 0, TAU); c.fill();
  }
  private gearBody(c: C, b: Body) {
    const M = this.L.metal, R = b.d.r ?? 3, n = b.d.teeth ?? 14, th = 0.18;
    const brass = this.id === "clockwork" ? "#D9A24A" : M.main;
    c.fillStyle = shade(brass, -0.35);
    c.beginPath();
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU, w = (Math.PI / n) * 0.5;
      c.lineTo(Math.cos(a - w * 1.4) * (R - th), Math.sin(a - w * 1.4) * (R - th));
      c.lineTo(Math.cos(a - w * 0.7) * R, Math.sin(a - w * 0.7) * R);
      c.lineTo(Math.cos(a + w * 0.7) * R, Math.sin(a + w * 0.7) * R);
      c.lineTo(Math.cos(a + w * 1.4) * (R - th), Math.sin(a + w * 1.4) * (R - th));
    }
    c.closePath(); c.fill();
    c.fillStyle = brass; c.beginPath(); c.arc(0, 0, R - th - 0.06, 0, TAU); c.fill();
    c.fillStyle = shade(brass, -0.25); c.beginPath(); c.arc(0, 0, R * 0.68, 0, TAU); c.fill();
    c.fillStyle = brass;
    for (let k = 0; k < 6; k++) { c.save(); c.rotate((k / 6) * TAU); c.fillRect(-0.18, 0, 0.36, R * 0.7); c.restore(); }
    c.fillStyle = shade(brass, 0.25); c.beginPath(); c.arc(0, 0, 0.5, 0, TAU); c.fill();
    c.fillStyle = shade(brass, -0.4); c.beginPath(); c.arc(0, 0, 0.18, 0, TAU); c.fill();
    c.strokeStyle = rgba("#FFFFFF", 0.3); c.lineWidth = 0.06; c.beginPath(); c.arc(0, 0, R - th - 0.12, Math.PI * 0.55, Math.PI * 0.95); c.stroke();
  }
}
