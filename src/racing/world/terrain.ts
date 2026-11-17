// Terrain: height function (rolling hills, ridged mountains, dunes, coasts, cloud seas) blended into the road,
// a single non-uniform grid mesh (dense near the track, sparse far away) with rich vertex colouring, and water.
import * as THREE from "three";
import type { GfxQuality } from "../types";
import type { Track } from "../track";
import type { ThemeLook } from "./themes";
import { TrackField, type Near } from "./field";
import * as TX from "./textures";

// ---------------------------------------------------------------- noise
function hash2(x: number, y: number, seed: number) { const h = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453; return h - Math.floor(h); }
export function vnoise(x: number, y: number, seed: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, y: number, seed: number, oct = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += vnoise(x * f, y * f, seed + i * 13) * a; f *= 2.03; a *= 0.5; } return s; }
export const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export interface Ground {
  field: TrackField;
  heightAt(x: number, z: number): number;
  /** water surface height, or null when the world has no water */
  waterY: number | null;
  baseY: number;
  cx: number; cz: number; span: number;
}

export function makeGround(track: Track, l: ThemeLook, q: GfxQuality): Ground {
  const b = track.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, baseY = b.minY - 1;
  const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) + 1900;
  const field = new TrackField(track, cx - span / 2, cx + span / 2, cz - span / 2, cz + span / 2, q === "low" ? 14 : q === "medium" ? 11 : 8);
  const hw = track.halfWidth, sh = track.shoulder, seed = track.seed % 1000;
  const g = l.ground, hills = g.hills;
  const water = l.water && !l.underwater && !l.floating ? l.water : null;
  const waterY = water ? baseY - (water.mode === "lake" ? 2.6 : 0.6) : null;
  // coast: the sea lies beyond the track on one side
  let cdx = 0, cdz = 0, coastD = 0;
  if (water?.mode === "coast") {
    const a = (seed * 0.6180339) % 1 * Math.PI * 2; cdx = Math.cos(a); cdz = Math.sin(a);
    let mx = -Infinity; for (let i = 0; i < track.n; i += 8) mx = Math.max(mx, (track.px[i] - cx) * cdx + (track.pz[i] - cz) * cdz);
    coastD = mx - 25;
  }
  const near0 = hw + sh + 2.5, near1 = hw + sh + 62;
  const NQ: Near = { i: 0, dist: 0, d: 0, y: 0 };
  const heightAt = (x: number, z: number) => {
    if (l.floating) return baseY - 150 + (fbm(x * 0.004, z * 0.004, seed, 3) - 0.5) * 50;
    const n = field.query(x, z, NQ);
    const near = smooth(near0, near1, n.dist);
    if (near <= 0) return n.y - 0.42;
    let roll =(fbm(x * 0.006, z * 0.006, seed, 4) - 0.45) * 26 * (0.4 + hills) + (vnoise(x * 0.0016, z * 0.0016, seed + 3) - 0.5) * 46 * hills;
    if (g.dunes) { const crest = 1 - Math.abs(Math.sin((x * 0.8 + z * 0.35) * 0.011 + fbm(x * 0.003, z * 0.003, seed + 7, 2) * 7)); roll += crest * crest * 22 * hills; }
    let mtn = 0;
    if (n.dist > 240) {
      let m = fbm(x * 0.0022, z * 0.0022, seed + 5, 5);
      if (g.ridged) { const r = 1 - Math.abs(m * 2 - 1); m = r * r * 1.15; }
      mtn = smooth(240, 900, n.dist) * Math.pow(m, 1.6) * 520 * hills;
    }
    let far = baseY + roll + mtn;
    if (waterY !== null) {
      if (water!.mode === "coast") {
        const u = (x - cx) * cdx + (z - cz) * cdz - coastD + (fbm(x * 0.004, z * 0.004, seed + 11, 3) - 0.5) * 180;
        far = far + (waterY - 16 - far) * smooth(-30, 150, u);
      } else far -= 3;
    }
    return (n.y - 0.42) * (1 - near) + far * near;
  };
  return { field, heightAt, waterY, baseY, cx, cz, span };
}

/** grid coordinates: fine spacing over the track area, coarse beyond */
function axis(min: number, max: number, inMin: number, inMax: number, fine: number, coarse: number) {
  const out: number[] = [];
  for (let x = min; x < inMin - coarse * 0.5; x += coarse) out.push(x);
  const nIn = Math.max(2, Math.round((inMax - inMin) / fine));
  for (let i = 0; i < nIn; i++) out.push(inMin + ((inMax - inMin) * i) / nIn);
  const nOut = Math.max(1, Math.round((max - inMax) / coarse));
  for (let i = 0; i <= nOut; i++) out.push(inMax + ((max - inMax) * i) / nOut);
  return out;
}

export function buildTerrain(track: Track, l: ThemeLook, G: Ground, q: GfxQuality, night: boolean, accent: string) {
  const b = track.bounds, { cx, cz, span, baseY, waterY } = G;
  const fine = q === "low" ? 18 : q === "medium" ? 12 : 7.5, coarse = q === "low" ? 85 : q === "medium" ? 64 : 42;
  const xs = axis(cx - span / 2, cx + span / 2, b.minX - 230, b.maxX + 230, fine, coarse);
  const zs = axis(cz - span / 2, cz + span / 2, b.minZ - 230, b.maxZ + 230, fine, coarse);
  const nx = xs.length, nz = zs.length, n = nx * nz;
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3), dist = new Float32Array(n);
  const NQ: Near = { i: 0, dist: 0, d: 0, y: 0 };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = xs[i], z = zs[j];
    pos[k * 3] = x; pos[k * 3 + 1] = G.heightAt(x, z); pos[k * 3 + 2] = z;
    uv[k * 2] = x / 10; uv[k * 2 + 1] = z / 10;
    dist[k] = l.floating ? 999 : G.field.query(x, z, NQ).dist;
  }
  const idx = n > 65535 ? new Uint32Array((nx - 1) * (nz - 1) * 6) : new Uint16Array((nx - 1) * (nz - 1) * 6);
  let o = 0;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, bb = a + 1, c = a + nx, d = c + 1;
    idx[o++] = a; idx[o++] = c; idx[o++] = bb; idx[o++] = bb; idx[o++] = c; idx[o++] = d;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  const nor = geo.attributes.normal as THREE.BufferAttribute;

  // ---------------------------------------------------------- colours
  const g = l.ground, seed = track.seed % 1000;
  const pal = g.colors.map((c) => new THREE.Color(c));
  const fields = g.fields?.map((c) => new THREE.Color(c));
  const mountain = new THREE.Color(g.mountain), rock = new THREE.Color(g.rock ?? g.mountain), snow = new THREE.Color("#F4F8FF");
  const verge = new THREE.Color(g.verge ?? g.colors[0]);
  const shore = new THREE.Color(l.water?.shore ?? "#D9C69A");
  const hw = track.halfWidth, sh = track.shoulder;
  const c = new THREE.Color(), t2 = new THREE.Color();
  const snowy = g.snowCaps || g.hills > 0.8;
  for (let k = 0; k < n; k++) {
    const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2], dd = dist[k];
    const nn = Math.min(1, Math.max(0, (fbm(x * 0.009, z * 0.009, seed + 9, 3) - 0.28) / 0.44)) * (pal.length - 1);
    const i0 = Math.floor(nn), f = nn - i0;
    c.copy(pal[i0]).lerp(pal[Math.min(pal.length - 1, i0 + 1)], f * f * (3 - 2 * f));
    if (fields && dd > hw + sh + 4 && dd < 520) {
      const rx = x * 0.8 + z * 0.6, rz = -x * 0.6 + z * 0.8;
      const fx = Math.floor(rx / 70), fz = Math.floor(rz / 46);
      const h = hash2(fx, fz, seed + 21);
      if (h < 0.78) { t2.copy(fields[Math.floor(h / 0.78 * fields.length) % fields.length]); c.lerp(t2, 0.85 * smooth(hw + sh + 4, hw + sh + 14, dd)); }
    }
    c.multiplyScalar(0.86 + 0.28 * vnoise(x * 0.05, z * 0.05, seed + 2));
    c.lerp(verge, 1 - smooth(hw + sh + 4, hw + sh + 18, dd));
    const hgt = (y - baseY) / 300;
    c.lerp(mountain, smooth(0.1, 0.5, hgt));
    const ny = nor.getY(k);
    c.lerp(rock, smooth(0.86, 0.66, ny) * 0.85);
    if (snowy) c.lerp(snow, smooth(0.5, 0.82, hgt + (vnoise(x * 0.01, z * 0.01, seed) - 0.5) * 0.15) * smooth(0.55, 0.75, ny));
    if (waterY !== null) {
      c.lerp(shore, smooth(waterY + 2.6, waterY + 0.4, y));
      if (y < waterY - 0.5) c.multiplyScalar(0.7);
    }
    col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));

  const kind = g.detail ?? "grass";
  const detail = kind === "none" ? null : TX.groundDetail(kind);
  const matP = { vertexColors: true, map: detail } as const;
  const mat = q === "low" ? new THREE.MeshLambertMaterial(matP) : new THREE.MeshStandardMaterial({ ...matP, roughness: kind === "snow" ? 0.75 : 0.95, metalness: 0, envMapIntensity: 0.5 });
  if (kind === "grid") { mat.emissiveMap = TX.gridGlow("#ffffff"); mat.emissive = new THREE.Color(accent); mat.emissiveIntensity = night ? 1.1 : 0.6; detail!.repeat.set(1 / 1.6, 1 / 1.6); mat.emissiveMap.repeat.set(1 / 1.6, 1 / 1.6); }
  if (l.floating) { mat.emissive = new THREE.Color("#ffffff"); mat.emissiveIntensity = 0.25; }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = q !== "low";

  // ---------------------------------------------------------- water
  let water: THREE.Mesh | null = null;
  let waterTex: THREE.Texture | null = null;
  if (waterY !== null && l.water) {
    const wseg = q === "low" ? 40 : 64;
    const wg = new THREE.PlaneGeometry(span, span, wseg, wseg).rotateX(-Math.PI / 2).translate(cx, waterY, cz);
    const wp = wg.attributes.position as THREE.BufferAttribute, wc = new Float32Array(wp.count * 3);
    const shallow = new THREE.Color(l.water.color), deep = new THREE.Color(l.water.deep);
    for (let i = 0; i < wp.count; i++) {
      const depth = waterY - G.heightAt(wp.getX(i), wp.getZ(i));
      c.copy(shallow).lerp(deep, smooth(0.5, 14, depth));
      wc[i * 3] = c.r; wc[i * 3 + 1] = c.g; wc[i * 3 + 2] = c.b;
    }
    wg.setAttribute("color", new THREE.BufferAttribute(wc, 3));
    waterTex = TX.waterNormals();
    waterTex.repeat.set(span / 40, span / 40);
    const frozen = !!l.water.frozen;
    const wm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: frozen ? 0.25 : 0.1, metalness: frozen ? 0.1 : 0.0, normalMap: waterTex, normalScale: new THREE.Vector2(frozen ? 0.08 : 0.3, frozen ? 0.08 : 0.3), envMapIntensity: frozen ? 0.8 : l.water.mode === "lake" ? 0.85 : 1.1 });
    water = new THREE.Mesh(wg, wm);
    water.receiveShadow = q === "high";
  }
  return {
    mesh, water,
    update(dt: number) { if (waterTex && !l.water?.frozen) { waterTex.offset.x += dt * 0.012; waterTex.offset.y += dt * 0.007; } },
  };
}
