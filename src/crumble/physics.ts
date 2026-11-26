// Moving bodies through the block world: a box (half-width, height) that slides along walls, steps up one block by
// itself (so stairs, kerbs and rubble never stop you), falls, lands, and bumps its head.
import { VS, type VoxelWorld } from "./voxels";

export interface Body { x: number; y: number; z: number; vx: number; vy: number; vz: number; hw: number; h: number; grounded: boolean }

const hits = (w: VoxelWorld, b: Body, x: number, y: number, z: number) => w.boxHits(x - b.hw, y, z - b.hw, x + b.hw, y + b.h, z + b.hw);
/** keep a body on the lot */
function clampLot(w: VoxelWorld, b: Body) {
  const minX = w.x0 + 0.6, maxX = w.x0 + w.nx * VS - 0.6, minZ = w.z0 + 0.6, maxZ = w.z0 + w.nz * VS - 0.6;
  if (b.x < minX) b.x = minX; else if (b.x > maxX) b.x = maxX;
  if (b.z < minZ) b.z = minZ; else if (b.z > maxZ) b.z = maxZ;
}
/** slide by (dx, dz); `step` lets it climb one block. Returns false when a wall stopped it. */
export function moveBody(w: VoxelWorld, b: Body, dx: number, dz: number, step = true) {
  let ok = true;
  const lift = VS + 0.02;
  if (dx !== 0) {
    const nx = b.x + dx;
    if (!hits(w, b, nx, b.y + 0.01, b.z)) b.x = nx;
    else if (step && b.grounded && !hits(w, b, nx, b.y + lift, b.z) && !hits(w, b, b.x, b.y + lift, b.z)) { b.x = nx; b.y += lift; }
    else ok = false;
  }
  if (dz !== 0) {
    const nz = b.z + dz;
    if (!hits(w, b, b.x, b.y + 0.01, nz)) b.z = nz;
    else if (step && b.grounded && !hits(w, b, b.x, b.y + lift, nz) && !hits(w, b, b.x, b.y + lift, b.z)) { b.z = nz; b.y += lift; }
    else ok = false;
  }
  clampLot(w, b);
  return ok;
}
/** gravity and landing; returns the landing speed (0 when it didn't land this frame) */
export function fallBody(w: VoxelWorld, b: Body, dt: number, g: number) {
  b.vy = Math.max(-30, b.vy - g * dt);
  const ny = b.y + b.vy * dt;
  if (b.vy <= 0) {
    if (hits(w, b, b.x, ny, b.z) || ny < VS) {
      const top = Math.max(VS, (Math.floor(ny / VS) + 1) * VS);
      const hit = -b.vy;
      if (!hits(w, b, b.x, top, b.z)) b.y = top;
      b.vy = 0;
      const was = b.grounded;
      b.grounded = true;
      return was ? 0 : hit;
    }
    b.y = ny; b.grounded = false;
    return 0;
  }
  if (hits(w, b, b.x, ny, b.z)) b.vy = 0; else b.y = ny;
  b.grounded = false;
  return 0;
}
/** standing inside blocks (something fell on it or it was built around it): push up */
export function unstick(w: VoxelWorld, b: Body) {
  for (let k = 0; k < 40 && hits(w, b, b.x, b.y + 0.01, b.z); k++) b.y += VS;
}
