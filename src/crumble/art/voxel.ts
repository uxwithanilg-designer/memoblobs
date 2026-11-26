// The voxel toolkit (for Crumble Crew's characters, robots, the van, tools, loot and the scenery). Three ways to build pixel-3D geometry, each merged into one buffer so a model is one draw call:
//  - skinned boxes: a box measured in pixels whose six faces map onto rectangles of a small pixel-art "skin" texture
//    (heads with faces, suits with straps, robot panels with glowing eyes), like a blocky toy figure;
//  - coloured voxels: boxes with a colour each, merged, with the faces shaded by direction (lit tops, darker sides) —
//    blasters, props, backdrop scenery;
//  - tiles: unit faces that take a 16×16 tile from the world's block atlas, with a shade per face for depth — the
//    arena itself.
import * as THREE from "three";

export type Face = "px" | "nx" | "py" | "ny" | "pz" | "nz";
export interface Rect { x: number; y: number; w: number; h: number }
/** face shading: tops lit, sides a little darker, bottoms darkest (on top of the scene's lights) */
export const SHADE: Record<Face, number> = { py: 1, pz: 0.9, nz: 0.8, px: 0.86, nx: 0.76, ny: 0.62 };

// the four corners of each face (unit cube from -0.5 to 0.5), counter-clockwise seen from outside, starting at the
// texture's bottom-left
const CORNERS: Record<Face, [number, number, number][]> = {
  pz: [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]],
  nz: [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]],
  px: [[0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5]],
  nx: [[-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5]],
  py: [[-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]],
  ny: [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]],
};
const NORMAL: Record<Face, [number, number, number]> = { px: [1, 0, 0], nx: [-1, 0, 0], py: [0, 1, 0], ny: [0, -1, 0], pz: [0, 0, 1], nz: [0, 0, -1] };
export const FACES: Face[] = ["px", "nx", "py", "ny", "pz", "nz"];

/** the six skin rectangles of a w×h×d (pixels) box laid out from (u, v), the classic blocky-figure skin layout */
export function skinLayout(u: number, v: number, w: number, h: number, d: number): Record<Face, Rect> {
  return {
    py: { x: u + d, y: v, w, h: d },
    ny: { x: u + d + w, y: v, w, h: d },
    nx: { x: u, y: v + d, w: d, h },
    pz: { x: u + d, y: v + d, w, h },
    px: { x: u + d + w, y: v + d, w: d, h },
    nz: { x: u + 2 * d + w, y: v + d, w, h },
  };
}

/** a merged buffer under construction */
export class Builder {
  pos: number[] = []; nor: number[] = []; uv: number[] = []; col: number[] = []; idx: number[] = [];
  private n = 0;
  /** one quad: four corners, a normal, uvs (or none) and a colour */
  quad(c: number[][], n: [number, number, number], uv: number[] | null, r: number, g: number, b: number) {
    for (let i = 0; i < 4; i++) {
      this.pos.push(c[i][0], c[i][1], c[i][2]); this.nor.push(n[0], n[1], n[2]); this.col.push(r, g, b);
      if (uv) this.uv.push(uv[i * 2], uv[i * 2 + 1]); else this.uv.push(0, 0);
    }
    const k = this.n;
    this.idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
    this.n += 4;
  }
  /** an axis-aligned box from its centre and size; `uvOf(face)` gives that face's uv quad, `colour` a 0xrrggbb */
  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, colour: number, uvOf?: (f: Face) => number[] | null, skip?: (f: Face) => boolean, shade = true) {
    const r = ((colour >> 16) & 255) / 255, g = ((colour >> 8) & 255) / 255, b = (colour & 255) / 255;
    for (const f of FACES) {
      if (skip?.(f)) continue;
      const s = shade ? SHADE[f] : 1;
      const cs = CORNERS[f].map(([x, y, z]) => [cx + x * sx, cy + y * sy, cz + z * sz]);
      this.quad(cs, NORMAL[f], uvOf ? uvOf(f) : null, r * s, g * s, b * s);
    }
  }
  get empty() { return this.n === 0; }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.n > 65000 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

/** uv quad (bottom-left, bottom-right, top-right, top-left) for a pixel rectangle of a size×size texture */
export function rectUv(r: Rect, size: number, flipX = false) {
  const e = 0.02; // a hair inside, so neighbouring pixels never bleed in
  const u0 = (r.x + e) / size, u1 = (r.x + r.w - e) / size, v0 = 1 - (r.y + r.h - e) / size, v1 = 1 - (r.y + e) / size;
  return flipX ? [u1, v0, u0, v0, u0, v1, u1, v1] : [u0, v0, u1, v0, u1, v1, u0, v1];
}

/**
 * A skinned box: w×h×d pixels at `px` metres per pixel, its skin laid out at (u, v) of a size×size texture, with the
 * pivot (the point the part turns around) at `pivot` (pixels, from the box's bottom-centre). Added to builder `b`.
 */
export function skinBox(b: Builder, w: number, h: number, d: number, px: number, u: number, v: number, size: number, at: [number, number, number], pivot: [number, number, number] = [0, 0, 0]) {
  const rects = skinLayout(u, v, w, h, d);
  const cx = at[0] - pivot[0] * px, cy = at[1] + (h / 2) * px - pivot[1] * px, cz = at[2] - pivot[2] * px;
  b.box(cx, cy, cz, w * px, h * px, d * px, 0xffffff, (f) => rectUv(rects[f], size, false), undefined, true);
  return rects;
}

/** "#rrggbb" or 0xrrggbb → 0xrrggbb */
export const C = (c: string | number) => (typeof c === "number" ? c : parseInt(c.slice(1, 7), 16));

/** the pixel-art textures: crisp pixels, no smoothing, no mipmaps (the blocky look) */
export function pixelTexture(cv: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
