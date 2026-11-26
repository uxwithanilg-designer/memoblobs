// The destructible world: a grid of 0.5 m blocks over the heist lot, drawn as chunk meshes (32×16×32 blocks each) of
// only the faces you can see, every face carrying its block's pixel tile from the district atlas, a little colour
// variation per block, face shading (lit tops, darker sides) and soft corner shadows (ambient occlusion from the
// blocks around each corner) — the "deep" look. Glass is drawn in its own see-through pass.
//  - carve(): a hit or a blast takes out every block in a sphere that the tool is strong enough to break;
//  - settle(): whatever was holding on only by what just broke — a wall, a roof, a whole storey — comes loose and falls
//    (found with a flood fill from the broken edge, capped so it stays cheap);
//  - raycast(): what the crosshair, a bolt or a hammer swing hits, and on which face;
//  - collision queries for the crew, the robots, debris and loot.
// Changed chunks are rebuilt a few per frame, so smashing never stalls the game.
import * as THREE from "three";
import { AIR, GLASS, GROUND, MAT, MATERIALS, PAINT, canBreak } from "./materials";
import { tileUv } from "./art/atlas";

export const VS = 0.5;
const CX = 32, CY = 16, CZ = 32;
const FACE_SHADE = [0.86, 0.76, 1, 0.6, 0.92, 0.8]; // +x −x +y −y +z −z
const AO = [1, 0.78, 0.62, 0.48];
export const PAINTS = [0xff4a6a, 0xffd23f, 0x5cf08a, 0x5bb8ff, 0xc87cff, 0xff8a3a, 0xffffff, 0x2a2d3a];

// growing scratch buffers for meshing (one chunk at a time)
let sPos = new Float32Array(4 * 3 * 8192), sNor = new Float32Array(4 * 3 * 8192), sUv = new Float32Array(4 * 2 * 8192), sCol = new Float32Array(4 * 3 * 8192), sIdx = new Uint32Array(6 * 8192);
function grow(quads: number) {
  if (quads * 4 * 3 <= sPos.length) return;
  const n = Math.ceil(quads * 1.5);
  const g = <T extends Float32Array | Uint32Array>(a: T, per: number): T => { const b = new (a.constructor as new (n: number) => T)(n * per); b.set(a); return b; };
  sPos = g(sPos, 12); sNor = g(sNor, 12); sUv = g(sUv, 8); sCol = g(sCol, 12); sIdx = g(sIdx, 6);
}

const DU_P = [0, 1, 1, 0], DV_P = [0, 0, 1, 1], DU_N = [0, 0, 1, 1], DV_N = [0, 1, 1, 0];
const P3 = new Int32Array(3), O3 = new Int32Array(3), S3 = new Int32Array(3), AO4 = new Float32Array(4);
const COL = [0, 0, 0];

export interface Hit { i: number; j: number; k: number; nx: number; ny: number; nz: number; t: number; m: number }

export class VoxelWorld {
  readonly nx: number; readonly ny: number; readonly nz: number;
  readonly data: Uint8Array; readonly tint: Uint8Array;
  /** world position of the corner of block (0, 0, 0) */
  readonly x0: number; readonly z0: number;
  readonly group = new THREE.Group();
  private ccx: number; private ccy: number; private ccz: number;
  private dirty: Uint8Array; private dirtyList: number[] = [];
  private meshes: (THREE.Mesh | null)[]; private glassMeshes: (THREE.Mesh | null)[];
  private cols = new Float32Array(MATERIALS * 6);
  private mark: Int32Array; private pass = 1; private queue: Int32Array;
  readonly opaque: THREE.MeshLambertMaterial; readonly clear: THREE.MeshLambertMaterial;
  shadows = false;

  constructor(nx: number, ny: number, nz: number, atlas: THREE.Texture) {
    this.nx = nx; this.ny = ny; this.nz = nz;
    this.data = new Uint8Array(nx * ny * nz); this.tint = new Uint8Array(nx * ny * nz);
    this.x0 = -nx * VS / 2; this.z0 = -nz * VS / 2;
    this.ccx = Math.ceil(nx / CX); this.ccy = Math.ceil(ny / CY); this.ccz = Math.ceil(nz / CZ);
    const nc = this.ccx * this.ccy * this.ccz;
    this.dirty = new Uint8Array(nc); this.meshes = new Array(nc).fill(null); this.glassMeshes = new Array(nc).fill(null);
    this.mark = new Int32Array(nx * ny * nz); this.queue = new Int32Array(8000);
    this.opaque = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true });
    this.clear = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false });
  }
  /** a material's colour for its top (0) and sides (1) */
  setColour(m: number, top: number, side = top) {
    const c = this.cols;
    c[m * 6] = ((top >> 16) & 255) / 255; c[m * 6 + 1] = ((top >> 8) & 255) / 255; c[m * 6 + 2] = (top & 255) / 255;
    c[m * 6 + 3] = ((side >> 16) & 255) / 255; c[m * 6 + 4] = ((side >> 8) & 255) / 255; c[m * 6 + 5] = (side & 255) / 255;
  }

  // ---------------------------------------------------------------- cells
  idx(i: number, j: number, k: number) { return (j * this.nz + k) * this.nx + i; }
  inside(i: number, j: number, k: number) { return i >= 0 && j >= 0 && k >= 0 && i < this.nx && j < this.ny && k < this.nz; }
  get(i: number, j: number, k: number) {
    if (j < 0) return GROUND;
    if (i < 0 || k < 0 || i >= this.nx || k >= this.nz || j >= this.ny) return AIR;
    return this.data[(j * this.nz + k) * this.nx + i];
  }
  set(i: number, j: number, k: number, m: number, tint = -1) {
    if (!this.inside(i, j, k)) return;
    const id = this.idx(i, j, k);
    this.data[id] = m;
    if (tint >= 0) this.tint[id] = tint;
    this.touch(i, j, k);
  }
  /** fill a box of cells (inclusive) */
  fill(i0: number, j0: number, k0: number, i1: number, j1: number, k1: number, m: number, tintRand = true) {
    for (let j = Math.max(0, j0); j <= Math.min(this.ny - 1, j1); j++) for (let k = Math.max(0, k0); k <= Math.min(this.nz - 1, k1); k++) for (let i = Math.max(0, i0); i <= Math.min(this.nx - 1, i1); i++) {
      const id = this.idx(i, j, k); this.data[id] = m; if (tintRand) this.tint[id] = (i * 73856093 ^ j * 19349663 ^ k * 83492791) & 255;
    }
  }
  private touch(i: number, j: number, k: number) {
    const ci = Math.floor(i / CX), cj = Math.floor(j / CY), ck = Math.floor(k / CZ);
    this.mark1(ci, cj, ck);
    const li = i - ci * CX, lj = j - cj * CY, lk = k - ck * CZ;
    if (li === 0) this.mark1(ci - 1, cj, ck); else if (li === CX - 1) this.mark1(ci + 1, cj, ck);
    if (lj === 0) this.mark1(ci, cj - 1, ck); else if (lj === CY - 1) this.mark1(ci, cj + 1, ck);
    if (lk === 0) this.mark1(ci, cj, ck - 1); else if (lk === CZ - 1) this.mark1(ci, cj, ck + 1);
  }
  private mark1(ci: number, cj: number, ck: number) {
    if (ci < 0 || cj < 0 || ck < 0 || ci >= this.ccx || cj >= this.ccy || ck >= this.ccz) return;
    const c = (cj * this.ccz + ck) * this.ccx + ci;
    if (!this.dirty[c]) { this.dirty[c] = 1; this.dirtyList.push(c); }
  }
  /** world → cell */
  ci(x: number) { return Math.floor((x - this.x0) / VS); }
  cj(y: number) { return Math.floor(y / VS); }
  ck(z: number) { return Math.floor((z - this.z0) / VS); }
  wx(i: number) { return this.x0 + (i + 0.5) * VS; }
  wy(j: number) { return (j + 0.5) * VS; }
  wz(k: number) { return this.z0 + (k + 0.5) * VS; }
  at(x: number, y: number, z: number) { return this.get(this.ci(x), this.cj(y), this.ck(z)); }
  solidAt(x: number, y: number, z: number) { return this.at(x, y, z) !== AIR; }
  /** does an axis-aligned box touch any block? */
  boxHits(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    const i0 = this.ci(x0), i1 = this.ci(x1 - 1e-4), j0 = this.cj(y0), j1 = this.cj(y1 - 1e-4), k0 = this.ck(z0), k1 = this.ck(z1 - 1e-4);
    for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) if (this.get(i, j, k) !== AIR) return true;
    return false;
  }
  /** the top of the highest block under a point at or below y (0 = the lot's floor level) */
  floorBelow(x: number, y: number, z: number) {
    const i = this.ci(x), k = this.ck(z);
    for (let j = Math.min(this.ny - 1, this.cj(y)); j >= 0; j--) if (this.get(i, j, k) !== AIR) return (j + 1) * VS;
    return 0;
  }
  /** the top of the column (for placing things) */
  top(x: number, z: number) { return this.floorBelow(x, this.ny * VS, z); }

  // ---------------------------------------------------------------- rays
  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number, out: Hit, skipGlass = false): boolean {
    let i = this.ci(ox), j = this.cj(oy), k = this.ck(oz);
    const si = dx > 0 ? 1 : -1, sj = dy > 0 ? 1 : -1, sk = dz > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(VS / dx) : 1e9, tdy = dy !== 0 ? Math.abs(VS / dy) : 1e9, tdz = dz !== 0 ? Math.abs(VS / dz) : 1e9;
    const bx = this.x0 + (i + (si > 0 ? 1 : 0)) * VS, by = (j + (sj > 0 ? 1 : 0)) * VS, bz = this.z0 + (k + (sk > 0 ? 1 : 0)) * VS;
    let tx = dx !== 0 ? (bx - ox) / dx : 1e9, ty = dy !== 0 ? (by - oy) / dy : 1e9, tz = dz !== 0 ? (bz - oz) / dz : 1e9;
    let t = 0, nx = 0, ny = 0, nz = 0;
    for (let n = 0; n < 400 && t <= max; n++) {
      const m = this.get(i, j, k);
      if (m !== AIR && !(skipGlass && m === GLASS)) { out.i = i; out.j = j; out.k = k; out.nx = nx; out.ny = ny; out.nz = nz; out.t = t; out.m = m; return true; }
      if (tx < ty && tx < tz) { i += si; t = tx; tx += tdx; nx = -si; ny = 0; nz = 0; }
      else if (ty < tz) { j += sj; t = ty; ty += tdy; nx = 0; ny = -sj; nz = 0; }
      else { k += sk; t = tz; tz += tdz; nx = 0; ny = 0; nz = -sk; }
      if (j < -1 || j > this.ny + 2) break;
    }
    return false;
  }
  /** is the straight line between two points clear of blocks (glass counts as clear when `glass` is true)? */
  clearLine(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, glass = false) {
    const d = Math.hypot(x1 - x0, y1 - y0, z1 - z0) || 1;
    const n = Math.ceil(d / 0.35);
    for (let s = 1; s < n; s++) {
      const t = s / n, m = this.at(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t);
      if (m !== AIR && !(glass && m === GLASS)) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------- breaking
  /**
   * Break every block in a sphere (centre in metres, radius in metres) that `power` can break. Each broken block goes
   * to `out` as [i, j, k, material] (up to `cap` of them; the rest still break). Returns how many broke.
   */
  carve(x: number, y: number, z: number, r: number, power: number, out: number[], cap = 400) {
    const i0 = this.ci(x - r), i1 = this.ci(x + r), j0 = Math.max(0, this.cj(y - r)), j1 = this.cj(y + r), k0 = this.ck(z - r), k1 = this.ck(z + r);
    let n = 0;
    for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
      if (!this.inside(i, j, k)) continue;
      const dx = this.wx(i) - x, dy = this.wy(j) - y, dz = this.wz(k) - z;
      if (dx * dx + dy * dy + dz * dz > r * r) continue;
      const id = this.idx(i, j, k), m = this.data[id];
      if (!canBreak(m, power)) continue;
      this.data[id] = AIR; this.touch(i, j, k); n++;
      if (out.length < cap * 4) out.push(i, j, k, m);
    }
    return n;
  }
  /** break one block */
  breakAt(i: number, j: number, k: number, power: number, out: number[]) {
    if (!this.inside(i, j, k)) return false;
    const id = this.idx(i, j, k), m = this.data[id];
    if (!canBreak(m, power)) return false;
    this.data[id] = AIR; this.touch(i, j, k);
    out.push(i, j, k, m);
    return true;
  }
  /** paint a block */
  paint(i: number, j: number, k: number, colour: number) {
    if (!this.inside(i, j, k)) return false;
    const id = this.idx(i, j, k), m = this.data[id];
    if (m === AIR || MAT[m].hard === 0 || m === GLASS) return false;
    this.data[id] = PAINT; this.tint[id] = colour; this.touch(i, j, k);
    return true;
  }
  /**
   * After blocks broke (`broken` as [i, j, k, m]…): find anything left hanging — flood-fill from each solid neighbour of
   * the break; a piece that never reaches the ground (within a budget) falls. Its blocks go to `fallen` as
   * [i, j, k, m] (the caller turns them into tumbling debris) and are removed. Returns how many fell.
   */
  settle(broken: number[], fallen: number[], budget = 6000) {
    let total = 0;
    if (this.queue.length < budget) this.queue = new Int32Array(budget);
    const q = this.queue, nx = this.nx, nz = this.nz, ny = this.ny, plane = nx * nz;
    // every flood this call gets its own pass number above `base`; a cell marked since `base` belongs to a piece
    // already found to stand on the ground
    const base = ++this.pass;
    for (let b = 0; b < broken.length && b < 1600; b += 4) {
      const bi = broken[b], bj = broken[b + 1], bk = broken[b + 2];
      for (let f = 0; f < 6; f++) {
        const i = bi + (f === 0 ? 1 : f === 1 ? -1 : 0), j = bj + (f === 2 ? 1 : f === 3 ? -1 : 0), k = bk + (f === 4 ? 1 : f === 5 ? -1 : 0);
        if (!this.inside(i, j, k)) continue;
        const start = this.idx(i, j, k);
        if (this.data[start] === AIR || this.mark[start] >= base) continue;
        const pass = ++this.pass;
        let head = 0, tail = 0, grounded = false;
        q[tail++] = start; this.mark[start] = pass;
        while (head < tail && !grounded) {
          const c = q[head++];
          const cj = Math.floor(c / plane), rem = c - cj * plane, ck = Math.floor(rem / nx), cii = rem - ck * nx;
          if (cj === 0 || MAT[this.data[c]].hard === 0 || tail >= budget - 6) { grounded = true; break; }
          for (let d = 0; d < 6; d++) {
            let nb = -1;
            if (d === 0) { if (cii + 1 < nx) nb = c + 1; } else if (d === 1) { if (cii > 0) nb = c - 1; }
            else if (d === 2) { if (cj + 1 < ny) nb = c + plane; } else if (d === 3) nb = c - plane;
            else if (d === 4) { if (ck + 1 < nz) nb = c + nx; } else if (ck > 0) nb = c - nx;
            if (nb < 0 || this.data[nb] === AIR || this.mark[nb] === pass) continue;
            if (this.mark[nb] >= base) { grounded = true; break; }
            this.mark[nb] = pass; q[tail++] = nb;
          }
        }
        if (grounded) { for (let s2 = 0; s2 < tail; s2++) this.mark[q[s2]] = base; continue; }
        // it's loose: everything in it falls
        for (let s2 = 0; s2 < tail; s2++) {
          const c = q[s2];
          const cj = Math.floor(c / plane), rem = c - cj * plane, ck = Math.floor(rem / nx), cii = rem - ck * nx;
          fallen.push(cii, cj, ck, this.data[c]);
          this.data[c] = AIR; this.touch(cii, cj, ck);
        }
        total += tail;
      }
    }
    return total;
  }

  // ---------------------------------------------------------------- meshing
  /** a block's colour (with its variation or paint) into r, g, b */
  private colour(m: number, id: number, side: boolean, out: number[]) {
    if (m === PAINT) { const p = PAINTS[this.tint[id] % PAINTS.length]; out[0] = ((p >> 16) & 255) / 255; out[1] = ((p >> 8) & 255) / 255; out[2] = (p & 255) / 255; return; }
    const o = m * 6 + (side ? 3 : 0), v = 0.94 + (this.tint[id] / 255) * 0.12;
    out[0] = this.cols[o] * v; out[1] = this.cols[o + 1] * v; out[2] = this.cols[o + 2] * v;
  }
  private occ(i: number, j: number, k: number) { const m = this.get(i, j, k); return m !== AIR && !MAT[m].clear ? 1 : 0; }

  private buildChunk(c: number) {
    const ccx = this.ccx, ccz = this.ccz;
    const cj = Math.floor(c / (ccx * ccz)), rem = c - cj * ccx * ccz, ck = Math.floor(rem / ccx), ci = rem - ck * ccx;
    for (const glassPass of [false, true]) {
      let q = 0;
      const col = COL;
      for (let j = cj * CY; j < Math.min(this.ny, (cj + 1) * CY); j++) for (let k = ck * CZ; k < Math.min(this.nz, (ck + 1) * CZ); k++) for (let i = ci * CX; i < Math.min(this.nx, (ci + 1) * CX); i++) {
        const id = this.idx(i, j, k), m = this.data[id];
        if (m === AIR) continue;
        const isGlass = !!MAT[m].clear;
        if (isGlass !== glassPass) continue;
        const uv = tileUv(MAT[m].tile);
        for (let f = 0; f < 6; f++) {
          const ax = f >> 1, s = f & 1 ? -1 : 1;
          const di = ax === 0 ? s : 0, dj = ax === 1 ? s : 0, dk = ax === 2 ? s : 0;
          const nm = this.get(i + di, j + dj, k + dk);
          if (j === 0 && dj < 0) continue;
          if (isGlass ? nm !== AIR : nm !== AIR && !MAT[nm].clear) continue;
          grow(q + 1);
          this.colour(m, id, ax !== 1, col);
          const sh = FACE_SHADE[f];
          // the face's corners along its two tangent axes (no allocation: scratch arrays)
          const ua = (ax + 1) % 3, va = (ax + 2) % 3;
          const DU = s > 0 ? DU_P : DU_N, DV = s > 0 ? DV_P : DV_N;
          for (let v = 0; v < 4; v++) {
            const du = DU[v], dv = DV[v];
            P3[0] = i; P3[1] = j; P3[2] = k;
            P3[ax] += s > 0 ? 1 : 0; P3[ua] += du; P3[va] += dv;
            // ambient occlusion from the three blocks around this corner, just outside the face
            O3[0] = i; O3[1] = j; O3[2] = k; O3[ax] += s;
            const su = du ? 1 : -1, sv = dv ? 1 : -1;
            S3[0] = O3[0]; S3[1] = O3[1]; S3[2] = O3[2]; S3[ua] += su;
            const a1 = this.occ(S3[0], S3[1], S3[2]);
            S3[ua] -= su; S3[va] += sv;
            const a2 = this.occ(S3[0], S3[1], S3[2]);
            S3[ua] += su;
            const occl = a1 && a2 ? 3 : a1 + a2 + this.occ(S3[0], S3[1], S3[2]);
            AO4[v] = AO[occl];
            const vi = q * 4 + v;
            sPos[vi * 3] = this.x0 + P3[0] * VS; sPos[vi * 3 + 1] = P3[1] * VS; sPos[vi * 3 + 2] = this.z0 + P3[2] * VS;
            sNor[vi * 3] = di; sNor[vi * 3 + 1] = dj; sNor[vi * 3 + 2] = dk;
            // texture: upright on the sides
            const tx = ax === 2 ? du : dv, ty = ax === 2 ? dv : du;
            sUv[vi * 2] = tx ? uv.u1 : uv.u0; sUv[vi * 2 + 1] = ty ? uv.v1 : uv.v0;
            const lit = sh * AO4[v];
            sCol[vi * 3] = col[0] * lit; sCol[vi * 3 + 1] = col[1] * lit; sCol[vi * 3 + 2] = col[2] * lit;
          }
          const ao = AO4;
          const b = q * 4, ii = q * 6;
          if (ao[0] + ao[2] < ao[1] + ao[3]) { sIdx[ii] = b + 1; sIdx[ii + 1] = b + 2; sIdx[ii + 2] = b + 3; sIdx[ii + 3] = b + 1; sIdx[ii + 4] = b + 3; sIdx[ii + 5] = b; }
          else { sIdx[ii] = b; sIdx[ii + 1] = b + 1; sIdx[ii + 2] = b + 2; sIdx[ii + 3] = b; sIdx[ii + 4] = b + 2; sIdx[ii + 5] = b + 3; }
          q++;
        }
      }
      const list = glassPass ? this.glassMeshes : this.meshes;
      const old = list[c];
      if (old) { this.group.remove(old); old.geometry.dispose(); list[c] = null; }
      if (q === 0) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(sPos.slice(0, q * 12), 3));
      g.setAttribute("normal", new THREE.BufferAttribute(sNor.slice(0, q * 12), 3));
      g.setAttribute("uv", new THREE.BufferAttribute(sUv.slice(0, q * 8), 2));
      g.setAttribute("color", new THREE.BufferAttribute(sCol.slice(0, q * 12), 3));
      g.setIndex(q * 4 > 65000 ? new THREE.BufferAttribute(sIdx.slice(0, q * 6), 1) : new THREE.BufferAttribute(Uint16Array.from(sIdx.subarray(0, q * 6)), 1));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, glassPass ? this.clear : this.opaque);
      mesh.castShadow = this.shadows && !glassPass; mesh.receiveShadow = this.shadows;
      if (glassPass) mesh.renderOrder = 2;
      list[c] = mesh;
      this.group.add(mesh);
    }
  }
  /** rebuild up to `n` changed chunks (all of them with n = Infinity) */
  rebuild(n = 3) {
    let done = 0;
    while (this.dirtyList.length && done < n) {
      const c = this.dirtyList.shift()!;
      this.dirty[c] = 0;
      this.buildChunk(c);
      done++;
    }
    return done;
  }
  /** mark every chunk for building (after the lot is made) */
  all() { for (let c = 0; c < this.dirty.length; c++) if (!this.dirty[c]) { this.dirty[c] = 1; this.dirtyList.push(c); } }
  get pending() { return this.dirtyList.length; }
  dispose() {
    for (const list of [this.meshes, this.glassMeshes]) for (const m of list) if (m) m.geometry.dispose();
    this.group.clear();
    this.opaque.dispose(); this.clear.dispose();
  }
}
