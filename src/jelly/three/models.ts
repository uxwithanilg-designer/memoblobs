// Momo Jelly Jam 3D models — glossy candy jelly, the toy tray, gates, floor tiles and the table props of every world.
// Built in code (no downloads). Sizes are in cells: one board cell = 1 unit, the board lies on z = 0 facing +z.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { merge, tint } from "../../crowd/models";
import type { PropKind } from "../data/worlds";

export type G = THREE.BufferGeometry;
const sphere = (r: number, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
const at = <T extends G>(g: T, x: number, y: number, z: number) => { g.translate(x, y, z); return g; };
const sc = <T extends G>(g: T, x: number, y: number, z: number) => { g.scale(x, y, z); return g; };
const cyl = (r0: number, r1: number, h: number, n = 18) => new THREE.CylinderGeometry(r0, r1, h, n);
export const rbox = (w: number, h: number, d: number, r = 0.08, s = 3) => new RoundedBoxGeometry(w, h, d, s, Math.max(0.001, Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002)));
/** cylinder standing on z (its axis along z) */
const cylZ = (r0: number, r1: number, h: number, n = 18) => { const g = cyl(r0, r1, h, n); g.rotateX(Math.PI / 2); return g; };

// ---------------------------------------------------------------- jelly
/** jelly slab height (top at JELLY_TOP above the floor) */
export const JELLY_H = 0.3, JELLY_BEVEL = 0.075, JELLY_TOP = JELLY_H + JELLY_BEVEL * 2;
/**
 * A glossy jelly slab shaped exactly like a polyomino: the outline of its cells, inset a little (a gap between
 * neighbours), corners rounded (outer corners round, inner corners softly), extruded with a deep bevel.
 */
export function jellyGeometry(c: number[]): G {
  const cells = new Set<string>();
  for (let i = 0; i < c.length; i += 2) cells.add(`${c[i]},${c[i + 1]}`);
  const has = (x: number, y: number) => cells.has(`${x},${y}`);
  // boundary edges, counter-clockwise around each cell
  const edges = new Map<string, [number, number]>();
  for (let i = 0; i < c.length; i += 2) {
    const x = c[i], y = c[i + 1];
    if (!has(x, y - 1)) edges.set(`${x},${y}`, [x + 1, y]);
    if (!has(x + 1, y)) edges.set(`${x + 1},${y}`, [x + 1, y + 1]);
    if (!has(x, y + 1)) edges.set(`${x + 1},${y + 1}`, [x, y + 1]);
    if (!has(x - 1, y)) edges.set(`${x},${y + 1}`, [x, y]);
  }
  // walk the loop (polyominoes here have no holes), keep only the corners
  const startKey = [...edges.keys()].sort()[0];
  const pts: [number, number][] = [];
  let k = startKey;
  for (let guard = 0; guard < 400; guard++) {
    const [sx, sy] = k.split(",").map(Number);
    pts.push([sx, sy]);
    const nxt = edges.get(k)!;
    k = `${nxt[0]},${nxt[1]}`;
    if (k === startKey) break;
  }
  const corners: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[(i + pts.length - 1) % pts.length], b = pts[i], d = pts[(i + 1) % pts.length];
    const d1x = Math.sign(b[0] - a[0]), d1y = Math.sign(b[1] - a[1]), d2x = Math.sign(d[0] - b[0]), d2y = Math.sign(d[1] - b[1]);
    if (d1x !== d2x || d1y !== d2y) corners.push(b);
  }
  const n = corners.length;
  const inset = JELLY_BEVEL + 0.045;
  const shape = new THREE.Shape();
  const pv: { x: number; y: number; ax: number; ay: number; bx: number; by: number; convex: boolean }[] = [];
  for (let i = 0; i < n; i++) {
    const a = corners[(i + n - 1) % n], b = corners[i], d = corners[(i + 1) % n];
    const ax = Math.sign(b[0] - a[0]), ay = Math.sign(b[1] - a[1]), bx = Math.sign(d[0] - b[0]), by = Math.sign(d[1] - b[1]);
    const convex = ax * by - ay * bx > 0;
    // inward (left) normals of both edges
    pv.push({ x: b[0] + (-ay - by) * inset, y: b[1] + (ax + bx) * inset, ax, ay, bx, by, convex });
  }
  for (let i = 0; i < n; i++) {
    const v = pv[i], r = v.convex ? 0.2 : 0.07;
    const p0x = v.x - v.ax * r, p0y = v.y - v.ay * r, p1x = v.x + v.bx * r, p1y = v.y + v.by * r;
    if (i === 0) shape.moveTo(p0x, p0y); else shape.lineTo(p0x, p0y);
    shape.quadraticCurveTo(v.x, v.y, p1x, p1y);
  }
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: JELLY_H, bevelEnabled: true, bevelThickness: JELLY_BEVEL, bevelSize: JELLY_BEVEL, bevelSegments: 4, curveSegments: 6 });
  g.translate(0, 0, JELLY_BEVEL);
  g.computeVertexNormals();
  return g;
}
/** where a jelly's face goes: the cell deepest inside its shape (centre of that cell) */
export function faceAnchor(c: number[]): [number, number, number] {
  const cells: [number, number][] = [];
  for (let i = 0; i < c.length; i += 2) cells.push([c[i], c[i + 1]]);
  const has = (x: number, y: number) => cells.some(([a, b]) => a === x && b === y);
  let best = cells[0], bestScore = -1;
  const cx = cells.reduce((s, p) => s + p[0], 0) / cells.length, cy = cells.reduce((s, p) => s + p[1], 0) / cells.length;
  for (const [x, y] of cells) {
    const score = (has(x - 1, y) ? 1 : 0) + (has(x + 1, y) ? 1 : 0) + (has(x, y - 1) ? 0.6 : 0) + (has(x, y + 1) ? 0.6 : 0) - Math.hypot(x - cx + 0.5 - 0.5, y - cy) * 0.35;
    if (score > bestScore) { bestScore = score; best = [x, y]; }
  }
  // a wide shape gets its face between two cells
  const wide = has(best[0] + 1, best[1]) && cells.length >= 4;
  return [best[0] + (wide ? 1 : 0.5), best[1] + 0.5, Math.min(1.35, 0.8 + Math.sqrt(cells.length) * 0.12)];
}
/** a jelly face: two glossy eyes (pupils separate, so they can look around) and a smile */
export function faceParts(): { eyes: G; pupils: G; lids: G; mouth: G } {
  const e: G[] = [], p: G[] = [], l: G[] = [];
  for (const sx of [-1, 1]) {
    e.push(tint(at(sc(sphere(0.105, 18, 14), 1, 1.12, 0.55), sx * 0.15, 0.07, 0), "#FFFFFF"));
    p.push(tint(at(sc(sphere(0.06, 14, 10), 1, 1.1, 0.5), sx * 0.15, 0.06, 0.04), "#1B1530"));
    p.push(tint(at(sphere(0.02, 8, 6), sx * 0.15 - 0.022, 0.09, 0.075), "#FFFFFF"));
    l.push(tint(at(sc(sphere(0.11, 14, 8), 1, 1.15, 0.62), sx * 0.15, 0.07, 0.006), "#FFFFFF"));
  }
  const m = new THREE.TorusGeometry(0.07, 0.018, 6, 14, Math.PI); m.rotateZ(Math.PI); m.translate(0, -0.1, 0.02);
  return { eyes: merge(e), pupils: merge(p), lids: merge(l), mouth: merge([tint(m, "#3A1428")]) };
}

// ---------------------------------------------------------------- tray
/** the rounded tray frame around a W × H board (a ring), its top at z = top */
export function trayFrame(W: number, H: number, border = 0.62, top = 0.34): G {
  const ox = W / 2 + border, oy = H / 2 + border, r = 0.55;
  const outer = new THREE.Shape();
  roundRect(outer, -ox, -oy, ox * 2, oy * 2, r);
  const hole = new THREE.Path();
  roundRect(hole, -W / 2 - 0.04, -H / 2 - 0.04, W + 0.08, H + 0.08, 0.16, true);
  outer.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(outer, { depth: top + 0.35, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 3, curveSegments: 10 });
  g.translate(0, 0, -0.35);
  return g;
}
function roundRect(p: THREE.Path, x: number, y: number, w: number, h: number, r: number, cw = false) {
  if (!cw) {
    p.moveTo(x + r, y); p.lineTo(x + w - r, y); p.quadraticCurveTo(x + w, y, x + w, y + r); p.lineTo(x + w, y + h - r);
    p.quadraticCurveTo(x + w, y + h, x + w - r, y + h); p.lineTo(x + r, y + h); p.quadraticCurveTo(x, y + h, x, y + h - r);
    p.lineTo(x, y + r); p.quadraticCurveTo(x, y, x + r, y);
  } else {
    p.moveTo(x + r, y); p.quadraticCurveTo(x, y, x, y + r); p.lineTo(x, y + h - r); p.quadraticCurveTo(x, y + h, x + r, y + h);
    p.lineTo(x + w - r, y + h); p.quadraticCurveTo(x + w, y + h, x + w, y + h - r); p.lineTo(x + w, y + r);
    p.quadraticCurveTo(x + w, y, x + w - r, y); p.lineTo(x + r, y);
  }
}
/** one floor tile (a soft square inset in its cell) */
export const floorTile = () => { const g = rbox(0.94, 0.94, 0.12, 0.08, 2); g.translate(0, 0, -0.06); return g; };
/** a gate: a coloured chute block set into the frame, with a raised arrow pointing out; w cells long along x, out = +y */
export function gate(w: number): { body: G; arrow: G } {
  // the chute sits on top of the frame (raised above it), spanning the frame from the board edge outwards
  const body = rbox(w - 0.08, 0.7, 0.3, 0.13, 3);
  body.translate(0, 0.33, 0.43);
  const s = new THREE.Shape();
  s.moveTo(-0.16, -0.06); s.lineTo(0, 0.12); s.lineTo(0.16, -0.06); s.lineTo(0.08, -0.06); s.lineTo(0, 0.02); s.lineTo(-0.08, -0.06); s.closePath();
  const arrow = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 2 });
  arrow.translate(0, 0.36, 0.58);
  return { body, arrow };
}
/** inner wall block (greedy rectangles are merged by the renderer) */
export const wallBlock = (w: number, h: number) => { const g = rbox(w - 0.05, h - 0.05, 0.62, 0.16, 3); g.translate(0, 0, 0.0); return g; };

// ---------------------------------------------------------------- canvas textures
export function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, repeat = false): THREE.CanvasTexture {
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
const FONT = "'Lilita One', ui-rounded, system-ui, sans-serif";
/** turn pad face: purple tile with two curved arrows (direction) */
export const padTex = (ccw: boolean) => canvasTex(256, 256, (c) => {
  const g = c.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, "#9A6BFF"); g.addColorStop(1, "#5B33C9");
  c.fillStyle = g; c.beginPath(); c.roundRect(10, 10, 236, 236, 46); c.fill();
  c.strokeStyle = "rgba(255,255,255,0.9)"; c.lineWidth = 20; c.lineCap = "round";
  for (const a0 of [0.35, Math.PI + 0.35]) {
    c.beginPath(); c.arc(128, 128, 66, a0, a0 + 2.1, ccw); c.stroke();
    const ae = a0 + (ccw ? -2.1 : 2.1), ex = 128 + Math.cos(ae) * 66, ey = 128 + Math.sin(ae) * 66;
    const tx = -Math.sin(ae) * (ccw ? -1 : 1), ty = Math.cos(ae) * (ccw ? -1 : 1);
    c.fillStyle = "rgba(255,255,255,0.95)"; c.beginPath();
    c.moveTo(ex + tx * 30, ey + ty * 30); c.lineTo(ex - ty * 26 - tx * 8, ey + tx * 26 - ty * 8); c.lineTo(ex + ty * 26 - tx * 8, ey - tx * 26 - ty * 8); c.fill();
  }
});
/** a little badge texture with a number */
export const badgeTex = (text: string, bg: string, fg = "#FFFFFF") => canvasTex(128, 128, (c) => {
  c.fillStyle = bg; c.beginPath(); c.arc(64, 64, 58, 0, Math.PI * 2); c.fill();
  c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = 8; c.stroke();
  c.fillStyle = fg; c.font = `bold 66px ${FONT}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(text, 64, 70);
});
/** belt surface: dark rubber with bright chevrons (scrolls along u) */
export const beltTex = () => canvasTex(128, 64, (c) => {
  c.fillStyle = "#2E2A44"; c.fillRect(0, 0, 128, 64);
  c.fillStyle = "#FFD23F";
  for (const x0 of [8, 72]) { c.beginPath(); c.moveTo(x0, 10); c.lineTo(x0 + 26, 32); c.lineTo(x0, 54); c.lineTo(x0 + 14, 54); c.lineTo(x0 + 40, 32); c.lineTo(x0 + 14, 10); c.fill(); }
}, true);
/** one-way arrow tile decal */
export const arrowTex = () => canvasTex(128, 128, (c) => {
  c.fillStyle = "rgba(255,255,255,0.0)"; c.fillRect(0, 0, 128, 128);
  c.fillStyle = "#FF8A2B"; c.beginPath(); c.roundRect(10, 10, 108, 108, 22); c.fill();
  c.fillStyle = "#FFFFFF"; c.beginPath(); c.moveTo(64, 22); c.lineTo(100, 66); c.lineTo(76, 66); c.lineTo(76, 104); c.lineTo(52, 104); c.lineTo(52, 66); c.lineTo(28, 66); c.closePath(); c.fill();
});
/** the colour symbol (colour-blind play) on a jelly */
export const symbolTex = (sym: string) => canvasTex(128, 128, (c) => {
  c.clearRect(0, 0, 128, 128);
  c.fillStyle = "rgba(255,255,255,0.55)"; c.font = `bold 84px ${FONT}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(sym, 64, 70);
});
/** the table under the tray */
export function tableTex(kind: PropKind, base: string, seed: number) {
  return canvasTex(512, 512, (c) => {
    c.fillStyle = base; c.fillRect(0, 0, 512, 512);
    let s = seed || 1; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    if (kind === "kitchen" || kind === "toys" || kind === "clocks" || kind === "pirate" || kind === "garden" || kind === "snow") {
      // wooden planks with grain
      for (let i = 0; i < 6; i++) {
        const y = i * 86;
        c.fillStyle = `rgba(90,50,20,${0.05 + rnd() * 0.06})`; c.fillRect(0, y, 512, 86);
        c.strokeStyle = "rgba(80,40,15,0.16)"; c.lineWidth = 2;
        for (let k = 0; k < 7; k++) { c.beginPath(); const yy = y + 8 + k * 11; c.moveTo(0, yy); for (let x = 0; x <= 512; x += 32) c.lineTo(x, yy + Math.sin((x + i * 70 + k * 23) * 0.02) * 3); c.stroke(); }
        c.fillStyle = "rgba(60,30,10,0.35)"; c.fillRect(0, y + 84, 512, 3);
      }
    } else if (kind === "candy" || kind === "icecream" || kind === "sky" || kind === "music") {
      // pastel candy stripes and sprinkles
      for (let i = -8; i < 16; i++) { c.fillStyle = i % 2 ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.06)"; c.beginPath(); c.moveTo(i * 48, 0); c.lineTo(i * 48 + 48, 0); c.lineTo(i * 48 + 48 + 260, 512); c.lineTo(i * 48 + 260, 512); c.fill(); }
      const sprinkle = ["#FF6FAE", "#7FD3FF", "#FFD23F", "#8BE36A", "#B98CFF"];
      for (let i = 0; i < 160; i++) { c.save(); c.translate(rnd() * 512, rnd() * 512); c.rotate(rnd() * 6.3); c.fillStyle = sprinkle[i % 5]; c.beginPath(); c.roundRect(-9, -3, 18, 6, 3); c.fill(); c.restore(); }
    } else {
      // soft speckled stone / felt
      const img = c.getImageData(0, 0, 512, 512);
      for (let i = 0; i < 512 * 512; i++) { const n = (rnd() - 0.5) * 22; img.data[i * 4] += n; img.data[i * 4 + 1] += n; img.data[i * 4 + 2] += n; }
      c.putImageData(img, 0, 0);
    }
  }, true);
}

// ---------------------------------------------------------------- table props (around the tray)
/** a prop for a world, centred on its footprint, standing on z = 0, roughly 1.2–2 units big */
export function prop(kind: PropKind, i: number): G {
  const v = i % 4;
  const p: G[] = [];
  switch (kind) {
    case "kitchen":
      if (v === 0) { // cupcake
        p.push(tint(at(cylZ(0.42, 0.32, 0.5, 20), 0, 0, 0.25), "#FF8FB8"));
        for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; p.push(tint(at(cylZ(0.03, 0.03, 0.5, 6), Math.cos(a) * 0.37, Math.sin(a) * 0.37, 0.25), "#F06F9C")); }
        p.push(tint(at(sc(sphere(0.48, 20, 14), 1, 1, 0.7), 0, 0, 0.62), "#FFF3E6"));
        p.push(tint(at(sphere(0.12, 12, 10), 0, 0, 1.0), "#E8243C"));
      } else if (v === 1) { // jam jar
        p.push(tint(at(cylZ(0.42, 0.42, 0.8, 22), 0, 0, 0.4), "#C81E35"));
        p.push(tint(at(cylZ(0.46, 0.46, 0.14, 22), 0, 0, 0.86), "#FFFFFF"));
        p.push(tint(at(cylZ(0.43, 0.43, 0.22, 22), 0, 0, 0.36), "#FFF0D9"));
      } else if (v === 2) { // cookie stack
        for (let k = 0; k < 3; k++) { p.push(tint(at(cylZ(0.5 - k * 0.03, 0.5 - k * 0.03, 0.12, 22), k * 0.05, -k * 0.04, 0.07 + k * 0.13), "#D9A066")); for (let q = 0; q < 4; q++) p.push(tint(at(sphere(0.05, 6, 4), Math.cos(q * 1.7 + k) * 0.25, Math.sin(q * 1.7 + k) * 0.25, 0.14 + k * 0.13), "#5A3218")); }
      } else { // wooden spoon
        const handle = rbox(1.5, 0.14, 0.1, 0.05, 2); handle.translate(0.4, 0, 0.06); p.push(tint(handle, "#C68B52"));
        p.push(tint(at(sc(sphere(0.3, 16, 12), 1.3, 1, 0.3), -0.55, 0, 0.09), "#C68B52"));
      }
      break;
    case "candy":
      if (v === 0) { // lollipop
        const stick = rbox(1.3, 0.08, 0.08, 0.03, 2); stick.translate(0.55, 0, 0.06); p.push(tint(stick, "#FFFFFF"));
        p.push(tint(at(cylZ(0.45, 0.45, 0.14, 26), -0.3, 0, 0.1), "#FF6FAE"));
        p.push(tint(at(new THREE.TorusGeometry(0.28, 0.06, 8, 26), -0.3, 0, 0.18), "#FFFFFF"));
      } else if (v === 1) { // gumballs
        const cols = ["#FF4FB4", "#2F7BFF", "#FFC21A", "#2FCB52", "#8E5BFF"];
        for (let k = 0; k < 6; k++) p.push(tint(at(sphere(0.22, 14, 10), Math.cos(k * 1.1) * 0.35, Math.sin(k * 1.1) * 0.35, 0.22), cols[k % 5]));
      } else if (v === 2) { // wrapped candy
        p.push(tint(at(sc(sphere(0.3, 16, 12), 1.25, 1, 0.8), 0, 0, 0.24), "#8E5BFF"));
        for (const sx of [-1, 1]) { const w = new THREE.ConeGeometry(0.26, 0.4, 12); w.rotateZ(sx * Math.PI / 2); w.translate(sx * 0.55, 0, 0.24); p.push(tint(w, "#C9A8FF")); }
      } else { // candy cane
        const tube = new THREE.TorusGeometry(0.3, 0.08, 8, 20, Math.PI); tube.translate(0, 0.5, 0.08); p.push(tint(tube, "#E8243C"));
        const st = rbox(0.16, 1.1, 0.16, 0.07, 2); st.translate(0.3, -0.05, 0.08); p.push(tint(st, "#FFFFFF"));
      }
      break;
    default: {
      // themed toy shapes for the later worlds: a soft ball, a block, a cone and a ring in the world's colours
      const palette: Record<string, string[]> = {
        toys: ["#FFB23F", "#3FA7FF", "#FF5F7A"], icecream: ["#FFD9E8", "#7FD3FF", "#C68B52"], bubbles: ["#BDF2FF", "#FFFFFF", "#7FD3FF"],
        garden: ["#6CCB5F", "#C68B52", "#FF8FB8"], clocks: ["#C9A06B", "#FFFFFF", "#6E4B32"], robots: ["#8C9BB5", "#FFD23F", "#3B4458"],
        pirate: ["#B5763F", "#FFD23F", "#3E7DA8"], space: ["#6B5BD6", "#FFD23F", "#2EC4B6"], haunted: ["#FF8A2B", "#E9E3F5", "#7E6BAE"],
        volcano: ["#FF7A3D", "#4A2A22", "#FFD23F"], music: ["#E07BD8", "#1B1530", "#FFFFFF"], art: ["#FF9F43", "#2F7BFF", "#FF4FB4"],
        snow: ["#FFFFFF", "#9CC8F0", "#FF8A2B"], desert: ["#E3B55B", "#6CCB5F", "#C9894F"], neon: ["#FF3DD4", "#23C8E8", "#FFD23F"],
        reef: ["#FF8FB8", "#2EC4B6", "#FFD23F"], sky: ["#FFFFFF", "#FFC1D9", "#BFE3FF"], fortress: ["#E8504F", "#2A1E24", "#FFD23F"],
      };
      const col = palette[kind] ?? ["#FFFFFF", "#CCCCCC", "#999999"];
      if (v === 0) p.push(tint(at(sphere(0.45, 20, 16), 0, 0, 0.45), col[0]));
      else if (v === 1) { const b = rbox(0.8, 0.8, 0.8, 0.14, 3); b.rotateZ(0.4); b.translate(0, 0, 0.4); p.push(tint(b, col[1])); }
      else if (v === 2) { const cn = new THREE.ConeGeometry(0.42, 1.1, 20); cn.rotateX(Math.PI / 2); cn.translate(0, 0, 0.55); p.push(tint(cn, col[2])); p.push(tint(at(sphere(0.12, 10, 8), 0, 0, 1.12), col[0])); }
      else { const t = new THREE.TorusGeometry(0.4, 0.14, 12, 26); t.translate(0, 0, 0.14); p.push(tint(t, col[0])); }
    }
  }
  return merge(p);
}

// ---------------------------------------------------------------- phase 2–3 looks
/** a floor tile with an icon: a glossy rounded square in `bg` with an emoji / glyph on it */
export const iconTex = (icon: string, bg: string, fg = "#FFFFFF", glyph = false) => canvasTex(160, 160, (c) => {
  const g = c.createLinearGradient(0, 0, 160, 160); g.addColorStop(0, bg); g.addColorStop(1, shade(bg, -0.22));
  c.fillStyle = g; c.beginPath(); c.roundRect(8, 8, 144, 144, 30); c.fill();
  c.strokeStyle = "rgba(255,255,255,0.55)"; c.lineWidth = 6; c.stroke();
  c.fillStyle = fg; c.textAlign = "center"; c.textBaseline = "middle";
  c.font = glyph ? `bold 86px ${FONT}` : "84px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
  c.fillText(icon, 80, 86);
});
/** a round badge with one or two emoji (special jellies) */
export const emojiBadge = (icons: string, bg = "#FFFFFF") => canvasTex(192, 128, (c) => {
  c.fillStyle = bg; c.beginPath(); c.roundRect(6, 10, 180, 108, 54); c.fill();
  c.strokeStyle = "rgba(43,29,78,0.25)"; c.lineWidth = 6; c.stroke();
  c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#2A1E4A";
  c.font = "72px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
  c.fillText(icons, 96, 70);
});
/** soft cloud for fogged cells */
export const fogTex = () => canvasTex(128, 128, (c) => {
  const g = c.createRadialGradient(64, 64, 8, 64, 64, 64); g.addColorStop(0, "rgba(236,232,250,1)"); g.addColorStop(0.82, "rgba(222,216,242,1)"); g.addColorStop(1, "rgba(214,208,236,0)");
  c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  c.fillStyle = "rgba(160,150,200,0.55)"; c.font = `bold 54px ${FONT}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("?", 64, 68);
});
/** planks for bridges */
export const plankTex = () => canvasTex(128, 128, (c) => {
  c.fillStyle = "#B9844F"; c.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? "#A87442" : "#C99359"; c.fillRect(4, 6 + i * 30, 120, 24); c.fillStyle = "rgba(60,30,10,0.35)"; c.fillRect(14, 16 + i * 30, 4, 4); c.fillRect(110, 16 + i * 30, 4, 4); }
});
/** stripes in two colours (Mix / Rainbow gates, striped jellies) */
export const stripeTex = (cols: string[]) => canvasTex(128, 32, (c) => {
  const w = 128 / cols.length;
  cols.forEach((col, i) => { c.fillStyle = col; c.fillRect(i * w, 0, w + 1, 32); });
}, true);
function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
