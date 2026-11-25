// Turns a 16×16 column of blocks into geometry: only the faces that touch air, each with its pixel tile and soft corner
// shadows (ambient occlusion: a corner tucked between blocks gets darker), so the blocky world looks deep and solid.
// Glowing blocks (spawner cores, crystals, lamps, lit windows at night) go into a second, unlit mesh.
import * as THREE from "three";
import { ATLAS_COLS, ATLAS_ROWS, BLOCKS, glowsAt } from "./blocks";
import { CHUNK, type Voxels } from "./voxels";

// face: normal, origin corner, u axis, v axis (u × v = normal, so the quads face out)
const FACES = [
  { n: [1, 0, 0], o: [1, 0, 1], u: [0, 0, -1], v: [0, 1, 0], tile: 1 },
  { n: [-1, 0, 0], o: [0, 0, 0], u: [0, 0, 1], v: [0, 1, 0], tile: 1 },
  { n: [0, 1, 0], o: [0, 1, 1], u: [1, 0, 0], v: [0, 0, -1], tile: 0 },
  { n: [0, -1, 0], o: [0, 0, 0], u: [1, 0, 0], v: [0, 0, 1], tile: 2 },
  { n: [0, 0, 1], o: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], tile: 1 },
  { n: [0, 0, -1], o: [1, 0, 0], u: [-1, 0, 0], v: [0, 1, 0], tile: 1 },
] as const;
const AO = [0.42, 0.62, 0.8, 1];
const CORNERS = [[0, 0], [1, 0], [1, 1], [0, 1]] as const;

class Buf {
  pos = new Float32Array(4096); nrm = new Float32Array(4096); uv = new Float32Array(4096); col = new Float32Array(4096);
  idx = new Uint32Array(4096); v = 0; i = 0;
  reset() { this.v = 0; this.i = 0; }
  grow() {
    const g = <T extends Float32Array | Uint32Array>(a: T, n: number): T => { if (a.length >= n) return a; const b = new (a.constructor as { new(n: number): T })(Math.max(n, a.length * 2)); b.set(a); return b; };
    this.pos = g(this.pos, (this.v + 4) * 3); this.nrm = g(this.nrm, (this.v + 4) * 3); this.uv = g(this.uv, (this.v + 4) * 2); this.col = g(this.col, (this.v + 4) * 3);
    this.idx = g(this.idx, this.i + 6);
  }
  geometry(): THREE.BufferGeometry | null {
    if (!this.i) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos.slice(0, this.v * 3), 3));
    g.setAttribute("normal", new THREE.BufferAttribute(this.nrm.slice(0, this.v * 3), 3));
    g.setAttribute("uv", new THREE.BufferAttribute(this.uv.slice(0, this.v * 2), 2));
    g.setAttribute("color", new THREE.BufferAttribute(this.col.slice(0, this.v * 3), 3));
    g.setIndex(new THREE.BufferAttribute(this.v > 65535 ? this.idx.slice(0, this.i) : Uint16Array.from(this.idx.subarray(0, this.i)), 1));
    g.computeBoundingSphere();
    return g;
  }
}
const lit = new Buf(), glow = new Buf();
const EPS = 0.0008;

export function meshChunk(V: Voxels, ci: number, night: boolean): { lit: THREE.BufferGeometry | null; glow: THREE.BufferGeometry | null } {
  lit.reset(); glow.reset();
  const cx = ci % V.cx, cz = Math.floor(ci / V.cx);
  const x0 = cx * CHUNK, z0 = cz * CHUNK, x1 = Math.min(V.X, x0 + CHUNK), z1 = Math.min(V.Z, z0 + CHUNK);
  const tw = 1 / ATLAS_COLS, th = 1 / ATLAS_ROWS;
  for (let y = 0; y < V.Y; y++) for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) {
    const id = V.data[(y * V.Z + z) * V.X + x];
    if (!id) continue;
    const def = BLOCKS[id];
    const isGlow = glowsAt(id, night);
    for (let f = 0; f < 6; f++) {
      const F = FACES[f];
      const fx = x + F.n[0], fy = y + F.n[1], fz = z + F.n[2];
      if (fy < 0) continue;
      if (V.get(fx, fy, fz)) continue;
      const b = isGlow ? glow : lit;
      b.grow();
      const t = def.tiles[F.tile];
      const u0 = (t % ATLAS_COLS) * tw + EPS, u1 = ((t % ATLAS_COLS) + 1) * tw - EPS;
      const vt = 1 - Math.floor(t / ATLAS_COLS) * th - EPS, vb = 1 - (Math.floor(t / ATLAS_COLS) + 1) * th + EPS;
      const ao = [0, 0, 0, 0];
      for (let k = 0; k < 4; k++) {
        const [a, c] = CORNERS[k];
        const px = x + F.o[0] + F.u[0] * a + F.v[0] * c, py = y + F.o[1] + F.u[1] * a + F.v[1] * c, pz = z + F.o[2] + F.u[2] * a + F.v[2] * c;
        const vi = b.v + k;
        b.pos[vi * 3] = px; b.pos[vi * 3 + 1] = py; b.pos[vi * 3 + 2] = pz;
        b.nrm[vi * 3] = F.n[0]; b.nrm[vi * 3 + 1] = F.n[1]; b.nrm[vi * 3 + 2] = F.n[2];
        b.uv[vi * 2] = a ? u1 : u0; b.uv[vi * 2 + 1] = c ? vt : vb;
        // corner shadow from the three cells around this corner, in front of the face
        const su = a ? 1 : -1, sv = c ? 1 : -1;
        const s1 = V.get(fx + F.u[0] * su, fy + F.u[1] * su, fz + F.u[2] * su) ? 1 : 0;
        const s2 = V.get(fx + F.v[0] * sv, fy + F.v[1] * sv, fz + F.v[2] * sv) ? 1 : 0;
        const s3 = V.get(fx + F.u[0] * su + F.v[0] * sv, fy + F.u[1] * su + F.v[1] * sv, fz + F.u[2] * su + F.v[2] * sv) ? 1 : 0;
        const o = s1 && s2 ? 0 : 3 - (s1 + s2 + s3);
        ao[k] = o;
        const l = isGlow ? 0.75 + o * 0.0833 : AO[o];
        b.col[vi * 3] = l; b.col[vi * 3 + 1] = l; b.col[vi * 3 + 2] = l;
      }
      const v = b.v;
      // flip the split so the shading runs smoothly across the quad
      if (ao[0] + ao[2] < ao[1] + ao[3]) { b.idx[b.i++] = v + 1; b.idx[b.i++] = v + 2; b.idx[b.i++] = v + 3; b.idx[b.i++] = v + 1; b.idx[b.i++] = v + 3; b.idx[b.i++] = v; }
      else { b.idx[b.i++] = v; b.idx[b.i++] = v + 1; b.idx[b.i++] = v + 2; b.idx[b.i++] = v; b.idx[b.i++] = v + 2; b.idx[b.i++] = v + 3; }
      b.v += 4;
    }
  }
  return { lit: lit.geometry(), glow: glow.geometry() };
}
