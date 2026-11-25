// The island as a grid of blocks: what's where, how worn each block is, ray casts for the blaster and the camera,
// box collisions for everyone who walks, and the part that makes towers fall: when a block breaks, any group of
// blocks that is no longer joined to the ground comes loose and tumbles down.
import { B, BLOCKS } from "./blocks";

export const CHUNK = 16;
export interface RayHit { x: number; y: number; z: number; nx: number; ny: number; nz: number; t: number; id: number }

export class Voxels {
  readonly data: Uint8Array;
  /** damage taken by each block */
  readonly worn: Uint8Array;
  /** chunks whose mesh must be rebuilt */
  readonly dirty = new Set<number>();
  readonly cx: number; readonly cz: number;
  constructor(readonly X: number, readonly Y: number, readonly Z: number) {
    this.data = new Uint8Array(X * Y * Z);
    this.worn = new Uint8Array(X * Y * Z);
    this.cx = Math.ceil(X / CHUNK); this.cz = Math.ceil(Z / CHUNK);
  }
  idx(x: number, y: number, z: number) { return (y * this.Z + z) * this.X + x; }
  inside(x: number, y: number, z: number) { return x >= 0 && y >= 0 && z >= 0 && x < this.X && y < this.Y && z < this.Z; }
  get(x: number, y: number, z: number) { return x < 0 || y < 0 || z < 0 || x >= this.X || y >= this.Y || z >= this.Z ? 0 : this.data[(y * this.Z + z) * this.X + x]; }
  /** solid for walking: outside the sides counts as a wall, below the floor as solid */
  solidAt(x: number, y: number, z: number) {
    if (y < 0) return true;
    if (x < 0 || z < 0 || x >= this.X || z >= this.Z) return true;
    if (y >= this.Y) return false;
    return this.data[(y * this.Z + z) * this.X + x] !== 0;
  }
  set(x: number, y: number, z: number, id: number) {
    if (!this.inside(x, y, z)) return;
    const i = this.idx(x, y, z);
    this.data[i] = id; this.worn[i] = 0;
    this.touch(x, z);
  }
  /** mark the chunk (and a neighbour when on its edge) for rebuilding */
  touch(x: number, z: number) {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    this.dirty.add(cz * this.cx + cx);
    const lx = x - cx * CHUNK, lz = z - cz * CHUNK;
    if (lx === 0 && cx > 0) this.dirty.add(cz * this.cx + cx - 1);
    if (lx === CHUNK - 1 && cx < this.cx - 1) this.dirty.add(cz * this.cx + cx + 1);
    if (lz === 0 && cz > 0) this.dirty.add((cz - 1) * this.cx + cx);
    if (lz === CHUNK - 1 && cz < this.cz - 1) this.dirty.add((cz + 1) * this.cx + cx);
  }
  /** the y just above the highest block in a column (0 if empty) */
  top(x: number, z: number) {
    x = Math.floor(x); z = Math.floor(z);
    if (x < 0 || z < 0 || x >= this.X || z >= this.Z) return 0;
    for (let y = this.Y - 1; y >= 0; y--) if (this.data[(y * this.Z + z) * this.X + x]) return y + 1;
    return 0;
  }
  /** the floor under a point: the top of the first block at or below y */
  floorBelow(x: number, y: number, z: number) {
    const ix = Math.floor(x), iz = Math.floor(z);
    for (let iy = Math.min(this.Y - 1, Math.floor(y)); iy >= 0; iy--) if (this.get(ix, iy, iz)) return iy + 1;
    return -50;
  }
  /** does an axis-aligned box touch any block? */
  boxHits(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    const ax = Math.floor(x0), bx = Math.floor(x1 - 1e-6), ay = Math.floor(y0), by = Math.floor(y1 - 1e-6), az = Math.floor(z0), bz = Math.floor(z1 - 1e-6);
    for (let y = ay; y <= by; y++) for (let z = az; z <= bz; z++) for (let x = ax; x <= bx; x++) if (this.solidAt(x, y, z)) return true;
    return false;
  }

  /** march a ray through the grid (Amanatides & Woo); fills `out` and returns true on a hit within maxT */
  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxT: number, out: RayHit) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity, tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity, tdz = dz !== 0 ? Math.abs(1 / dz) : Infinity;
    let tx = dx !== 0 ? (dx > 0 ? x + 1 - ox : ox - x) * tdx : Infinity;
    let ty = dy !== 0 ? (dy > 0 ? y + 1 - oy : oy - y) * tdy : Infinity;
    let tz = dz !== 0 ? (dz > 0 ? z + 1 - oz : oz - z) * tdz : Infinity;
    let nx = 0, ny = 0, nz = 0, t = 0;
    for (let i = 0; i < 400; i++) {
      if (y >= 0 && y < this.Y && x >= 0 && z >= 0 && x < this.X && z < this.Z) {
        const id = this.data[(y * this.Z + z) * this.X + x];
        if (id) { out.x = x; out.y = y; out.z = z; out.nx = nx; out.ny = ny; out.nz = nz; out.t = t; out.id = id; return true; }
      } else if (y < 0) return false;
      if (tx < ty && tx < tz) { t = tx; if (t > maxT) return false; x += sx; tx += tdx; nx = -sx; ny = 0; nz = 0; }
      else if (ty < tz) { t = ty; if (t > maxT) return false; y += sy; ty += tdy; nx = 0; ny = -sy; nz = 0; }
      else { t = tz; if (t > maxT) return false; z += sz; tz += tdz; nx = 0; ny = 0; nz = -sz; }
      if (x < -2 || z < -2 || x > this.X + 2 || z > this.Z + 2 || y > this.Y + 8) return false;
    }
    return false;
  }

  /** wear a block down; true when it breaks (it is then removed) */
  damage(x: number, y: number, z: number, amount: number) {
    if (!this.inside(x, y, z)) return false;
    const i = this.idx(x, y, z), id = this.data[i];
    if (!id || id === B.BEDROCK) return false;
    const hp = BLOCKS[id].hp;
    const w = this.worn[i] + amount;
    if (w >= hp) { this.data[i] = 0; this.worn[i] = 0; this.touch(x, z); return true; }
    this.worn[i] = w;
    return false;
  }
  /** how worn a block is, 0..1 */
  wear(x: number, y: number, z: number) {
    const i = this.idx(x, y, z), id = this.data[i];
    return id ? this.worn[i] / BLOCKS[id].hp : 0;
  }

  // ------------------------------------------------------------------ toppling
  private seen = new Uint32Array(0); private stamp = 1;
  private stack = new Int32Array(4096);
  /** after blocks at these cells broke: find every group of blocks next to them that no longer reaches the ground.
   *  Each loose group is removed from the grid and returned as cell lists [x, y, z, id, …]. */
  loosened(cells: number[], limit = 700): number[][] {
    if (this.seen.length !== this.data.length) this.seen = new Uint32Array(this.data.length);
    const out: number[][] = [];
    const N = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    // neighbours in push order: up first, down last, so the walk heads down (towards the ground) first
    const ORDER = [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0]];
    const G = ++this.stamp; // "known to reach the ground" during this call
    for (let c = 0; c < cells.length; c += 3) {
      for (const [ax, ay, az] of N) {
        const sx = cells[c] + ax, sy = cells[c + 1] + ay, sz = cells[c + 2] + az;
        if (!this.inside(sx, sy, sz)) continue;
        const si = this.idx(sx, sy, sz);
        if (!this.data[si] || this.seen[si] === G) continue;
        // walk the group until it touches the floor layer, meets a grounded block, or grows too big to fall
        const mark = ++this.stamp;
        const group: number[] = [];
        let sp = 0, grounded = false;
        this.stack[sp++] = si; this.seen[si] = mark;
        walk: while (sp > 0) {
          const i = this.stack[--sp];
          const x = i % this.X, z = Math.floor(i / this.X) % this.Z, y = Math.floor(i / (this.X * this.Z));
          group.push(i);
          if (y <= 1 || group.length > limit) { grounded = true; break; }
          for (const [dx, dy, dz] of ORDER) {
            const nx = x + dx, ny = y + dy, nz = z + dz;
            if (!this.inside(nx, ny, nz)) continue;
            const ni = this.idx(nx, ny, nz);
            if (!this.data[ni]) continue;
            const s = this.seen[ni];
            if (s === G) { grounded = true; break walk; }
            if (s === mark) continue;
            if (sp >= this.stack.length) { const ns = new Int32Array(this.stack.length * 2); ns.set(this.stack); this.stack = ns; }
            this.seen[ni] = mark; this.stack[sp++] = ni;
          }
        }
        if (grounded) { for (const i of group) this.seen[i] = G; continue; }
        const cellsOut: number[] = [];
        for (const i of group) {
          const x = i % this.X, z = Math.floor(i / this.X) % this.Z, y = Math.floor(i / (this.X * this.Z));
          cellsOut.push(x, y, z, this.data[i]);
          this.data[i] = 0; this.worn[i] = 0; this.touch(x, z);
        }
        out.push(cellsOut);
      }
    }
    if (this.stamp > 4e9) { this.stamp = 1; this.seen.fill(0); }
    return out;
  }
}
