// Obby Bike Blaster's pixel textures: one 16×16 tile per course material, painted here from the world's palette and
// repeated across every box in world space (16 pixels to a metre, so a long bridge and a small step share the same
// crisp pixels). Classic two-tone checker decks with a light rim, walls, glowing kill blocks with cracks, ice with
// streaks, wobbly jelly, conveyor belts and boost strips with arrows (they scroll), wooden planks, metal plates, stone,
// crates with metal corners, bullseye targets, checkpoint pads and the black-and-white finish.
import * as THREE from "three";
import type { Mat } from "./course";
import type { World } from "./worlds";
import { makeRng, mix, shade } from "./util";

const T = 16;
type Px = (x: number, y: number) => string;
function paint(f: Px, seed: number, size = T) {
  const cv = document.createElement("canvas"); cv.width = size; cv.height = size;
  const c = cv.getContext("2d")!;
  void seed;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { c.fillStyle = f(x, y); c.fillRect(x, y, 1, 1); }
  return cv;
}
/** the 2 m × 2 m checker decks (32 px), each 1 m block with its own rim and grain */
function checker(a: string, b: string, n: (c: string, a: number) => string) {
  return paint((x, y) => { const c = ((x >> 4) + (y >> 4)) % 2 ? b : a; return rim(c, x % 16, y % 16, 0.8) ?? n(c, 0.06); }, 1, 32);
}
/** a block's rim: a light top-left edge and a dark bottom-right edge, so each metre reads as one block */
const rim = (c: string, x: number, y: number, k = 1) => (x === 0 || y === 0 ? shade(c, 0.16 * k) : x === T - 1 || y === T - 1 ? shade(c, -0.24 * k) : null);

export function paintMaterials(w: World, night: boolean): Record<Mat, HTMLCanvasElement> {
  const P = w.pal, r = makeRng(w.seed);
  const n = (c: string, a: number) => shade(c, (r() - 0.5) * a);
  const out = {} as Record<Mat, HTMLCanvasElement>;
  // the checker deck: each 1 m block is one colour, with grain and a rim (the faces alternate by world position, see
  // the shader in render.ts; here the A and B tiles are painted separately)
  out.platA = checker(P.platA, P.platB, n);
  out.platB = checker(shade(P.platB, 0.12), shade(P.platB, -0.08), n);
  out.start = paint((x, y) => rim(P.accent2, x, y) ?? (((x >> 2) + (y >> 2)) % 2 ? n(P.accent2, 0.05) : n(shade(P.accent2, 0.25), 0.05)), 3);
  out.edge = paint((x, y) => rim(P.edge, x, y) ?? n(P.edge, 0.05), 4);
  out.wall = paint((x, y) => { const row = y >> 2, off = row % 2 ? 4 : 0; return y % 4 === 3 || (x + off) % 8 === 7 ? shade(P.wall, -0.3) : n(shade(P.wall, row % 2 ? 0.04 : -0.02), 0.1); }, 5);
  out.kill = paint((x, y) => { const v = Math.sin(x * 0.9 + y * 0.4) + Math.cos(y * 1.1 - x * 0.3); return v > 1.2 ? "#ffffff" : v > 0.5 ? mix(P.kill, "#ffffff", 0.35) : v < -1.1 ? shade(P.kill, -0.45) : n(P.kill, 0.1); }, 6);
  out.ice = paint((x, y) => { const s = (x + y * 2) % 13; return s < 2 ? "#ffffff" : rim(P.ice, x, y, 0.5) ?? n(shade(P.ice, (y / 16) * -0.1), 0.05); }, 7);
  out.jelly = paint((x, y) => { const d = Math.hypot(x - 7.5, y - 7.5); return d < 2 ? mix(P.jelly, "#ffffff", 0.6) : d > 7.2 ? shade(P.jelly, -0.3) : n(shade(P.jelly, 0.1 - d * 0.03), 0.05); }, 8);
  // belts and boosts: arrows pointing along +v (the shader scrolls them)
  const arrow = (x: number, y: number) => { const cxp = Math.abs(x - 7.5); return y >= 3 && y <= 12 && cxp < (y - 2) * 0.7 && cxp > (y - 2) * 0.7 - 2.5; };
  out.belt = paint((x, y) => (x === 0 || x === T - 1 ? "#2a2a33" : arrow(x, y) ? P.accent : y % 4 === 0 ? "#3a3a46" : n("#4a4a58", 0.08)), 9);
  out.boost = paint((x, y) => (arrow(x, y) ? "#ffffff" : rim(P.accent2, x, y) ?? n(P.accent2, 0.08)), 10);
  out.wood = paint((x, y) => { const row = Math.floor(y / 4), seam = y % 4 === 3, off = (row * 7) % 16; return seam || (x + off) % 16 === 0 ? shade(P.wood, -0.32) : (x + off) % 16 === 2 && y % 4 === 1 ? shade(P.wood, -0.45) : n(shade(P.wood, row % 2 ? 0.05 : -0.04), 0.08); }, 11);
  out.metal = paint((x, y) => rim(P.metal, x, y, 1.2) ?? ((x === 2 || x === 13) && (y === 2 || y === 13) ? shade(P.metal, 0.35) : n(P.metal, 0.05)), 12);
  out.stone = paint((x, y) => { const v = r(); return rim(P.stone, x, y) ?? (v < 0.35 ? shade(P.stone, (r() - 0.5) * 0.26) : (x + y * 3) % 11 === 0 ? shade(P.stone, -0.3) : P.stone); }, 13);
  out.crate = paint((x, y) => { if ((x < 3 || x > 12) && (y < 3 || y > 12)) return "#9AA3B5"; if (x < 1 || x > 14 || y < 1 || y > 14) return "#5A3A1E"; if (x === y || x === 15 - y) return "#7C5130"; return y % 5 === 2 ? "#7C5130" : n("#B07A44", 0.1); }, 14);
  out.target = paint((x, y) => { const d = Math.hypot(x - 7.5, y - 7.5); return d < 2 ? "#FFE45C" : d < 4 ? "#ffffff" : d < 6 ? "#FF3B4E" : d < 7.5 ? "#ffffff" : "#FF3B4E"; }, 15);
  out.cp = paint((x, y) => { const stripe = (x + y) % 8 < 4; return rim(P.accent, x, y) ?? (stripe ? n(P.accent, 0.05) : n(shade(P.accent, -0.15), 0.05)); }, 16);
  out.finish = paint((x, y) => ((x >> 2) + (y >> 2)) % 2 ? "#ffffff" : "#16161e", 17);
  out.move = paint((x, y) => { if (x < 2 || x > 13) return (y + (x < 2 ? 0 : 2)) % 4 < 2 ? "#FFC83D" : "#1d1d24"; return rim(P.accent2, x, y) ?? n(mix(P.accent2, "#ffffff", 0.15), 0.06); }, 18);
  out.glass = paint((x, y) => { if (x === 0 || y === 0 || x === T - 1 || y === T - 1) return shade(P.metal, -0.1); return (x - y === 3 || x - y === 4) ? "#ffffff" : night ? mix(P.glow, "#ffffff", 0.2) : mix(P.accent2, "#ffffff", 0.55); }, 19);
  return out;
}

/** materials whose texture covers 2 m (the checker decks) */
export const BIG_MATS: Mat[] = ["platA", "platB"];
/** materials glowing on their own (not lit): kill blocks, targets, laser gates */
export const GLOW_MATS: Mat[] = ["kill", "target", "boost"];
export function textureOf(cv: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
