// O(1) "nearest point on the track" lookups for terrain and scenery placement.
// A coarse grid stores, for every node, the index of the closest centre-line sample (seeded from the samples
// and propagated with a two-pass sweep, like a Euclidean distance transform). A query looks at the four
// surrounding nodes' candidates and refines along the track, so it costs ~20 distance tests instead of a
// scan over the whole loop.
import type { Track } from "../track";

export interface Near {
  /** sample index of the closest centre-line point */
  i: number;
  /** distance to the centre line (m) */
  dist: number;
  /** signed lateral offset (m, + = right of travel) */
  d: number;
  /** road surface height at the clamped lateral offset (includes banking) */
  y: number;
}

export class TrackField {
  readonly x0: number; readonly z0: number; readonly nx: number; readonly nz: number; readonly cell: number;
  private idx: Int32Array;
  private track: Track;

  constructor(track: Track, minX: number, maxX: number, minZ: number, maxZ: number, cell: number) {
    this.track = track;
    this.cell = cell;
    this.x0 = minX; this.z0 = minZ;
    const nx = (this.nx = Math.ceil((maxX - minX) / cell) + 1), nz = (this.nz = Math.ceil((maxZ - minZ) / cell) + 1);
    const idx = (this.idx = new Int32Array(nx * nz).fill(-1));
    const best = new Float32Array(nx * nz).fill(Infinity);
    const { px, pz, n } = track;
    // seed: every sample marks the node nearest to it (and its neighbours)
    for (let k = 0; k < n; k++) {
      const gx = Math.round((px[k] - minX) / cell), gz = Math.round((pz[k] - minZ) / cell);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const x = gx + a, z = gz + b;
        if (x < 0 || z < 0 || x >= nx || z >= nz) continue;
        const dx = minX + x * cell - px[k], dz = minZ + z * cell - pz[k], dd = dx * dx + dz * dz, o = z * nx + x;
        if (dd < best[o]) { best[o] = dd; idx[o] = k; }
      }
    }
    const tryN = (o: number, x: number, z: number, cand: number) => {
      if (cand < 0) return;
      const dx = minX + x * cell - px[cand], dz = minZ + z * cell - pz[cand], dd = dx * dx + dz * dz;
      if (dd < best[o]) { best[o] = dd; idx[o] = cand; }
    };
    // forward sweep
    for (let z = 0; z < nz; z++) {
      for (let x = 0; x < nx; x++) {
        const o = z * nx + x;
        if (x > 0) tryN(o, x, z, idx[o - 1]);
        if (z > 0) { tryN(o, x, z, idx[o - nx]); if (x > 0) tryN(o, x, z, idx[o - nx - 1]); if (x < nx - 1) tryN(o, x, z, idx[o - nx + 1]); }
      }
      for (let x = nx - 2; x >= 0; x--) { const o = z * nx + x; tryN(o, x, z, idx[o + 1]); }
    }
    // backward sweep
    for (let z = nz - 1; z >= 0; z--) {
      for (let x = nx - 1; x >= 0; x--) {
        const o = z * nx + x;
        if (x < nx - 1) tryN(o, x, z, idx[o + 1]);
        if (z < nz - 1) { tryN(o, x, z, idx[o + nx]); if (x < nx - 1) tryN(o, x, z, idx[o + nx + 1]); if (x > 0) tryN(o, x, z, idx[o + nx - 1]); }
      }
      for (let x = 1; x < nx; x++) { const o = z * nx + x; tryN(o, x, z, idx[o - 1]); }
    }
  }

  private refine(x: number, z: number, start: number) {
    const { px, pz, n } = this.track;
    let i = start, bd = (px[i] - x) ** 2 + (pz[i] - z) ** 2;
    for (let dir = 1; dir >= -1; dir -= 2) {
      for (let k = 0; k < 40; k++) {
        const j = (i + dir + n) % n, dd = (px[j] - x) ** 2 + (pz[j] - z) ** 2;
        if (dd >= bd) break;
        bd = dd; i = j;
      }
    }
    _ri = i; return bd;
  }

  /** nearest centre-line sample to (x, z); writes into `out` (no allocation) */
  query(x: number, z: number, out: Near): Near {
    const t = this.track, c = this.cell;
    let fx = (x - this.x0) / c, fz = (z - this.z0) / c;
    fx = Math.min(this.nx - 1.001, Math.max(0, fx)); fz = Math.min(this.nz - 1.001, Math.max(0, fz));
    const gx = Math.floor(fx), gz = Math.floor(fz), o = gz * this.nx + gx;
    let bi = -1, bd = Infinity, last = -2;
    for (let k = 0; k < 4; k++) {
      const cand = this.idx[o + (k & 1) + (k >> 1) * this.nx];
      if (cand < 0 || Math.abs(cand - last) < 2) continue;
      last = cand;
      const dd = this.refine(x, z, cand);
      if (dd < bd) { bd = dd; bi = _ri; }
    }
    if (bi < 0) bi = 0;
    const dx = x - t.px[bi], dz = z - t.pz[bi];
    const d = dx * t.rx[bi] + dz * t.rz[bi];
    const lim = t.halfWidth + t.shoulder + 1.5;
    out.i = bi; out.dist = Math.sqrt(bd === Infinity ? dx * dx + dz * dz : bd); out.d = d;
    out.y = t.py[bi] - Math.max(-lim, Math.min(lim, d)) * t.bank[bi];
    return out;
  }
}
let _ri = 0;
