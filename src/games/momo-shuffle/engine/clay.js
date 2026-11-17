// Clay toolkit: plasticine material (fingerprints, lumps, colour variation),
// lumpy geometry, and small mesh helpers shared by characters and sets.
import * as THREE from 'three';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- CPU value noise for lumpy geometry ----------
function h3(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }
function vn(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const L = (a, b, t) => a + (b - a) * t;
  return L(
    L(L(h3(xi, yi, zi), h3(xi + 1, yi, zi), u), L(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), u), v),
    L(L(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), u), L(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), u), v), w);
}
export function fbm(x, y, z) { return vn(x, y, z) * 0.6 + vn(x * 2.1, y * 2.1, z * 2.1) * 0.3 + vn(x * 4.3, y * 4.3, z * 4.3) * 0.1; }

// Average normals of coincident vertices (UV seams) so lumps don't show seams.
function smoothSeams(geo) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  const map = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${Math.round(p.getX(i) * 1e4)},${Math.round(p.getY(i) * 1e4)},${Math.round(p.getZ(i) * 1e4)}`;
    let a = map.get(k); if (!a) { a = []; map.set(k, a); } a.push(i);
  }
  const out = new Float32Array(n.array);
  const a1 = new THREE.Vector3(), a2 = new THREE.Vector3(), sum = new THREE.Vector3();
  for (const grp of map.values()) {
    if (grp.length < 2) continue;
    for (const i of grp) {
      a1.fromBufferAttribute(n, i); sum.set(0, 0, 0);
      for (const j of grp) { a2.fromBufferAttribute(n, j); if (a2.dot(a1) > 0.5) sum.add(a2); }
      sum.normalize(); out[i * 3] = sum.x; out[i * 3 + 1] = sum.y; out[i * 3 + 2] = sum.z;
    }
  }
  n.array.set(out); n.needsUpdate = true;
}

// Displace vertices for a hand-squished look. 'radial' mode is crack-free on
// closed shapes; 'normal' mode is for open sheets (walls, curtains).
export function lumpy(geo, { amp = 0.02, freq = 2.2, seed = 0, mode = 'radial' } = {}) {
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const p = geo.attributes.position, n = geo.attributes.normal;
  const d3 = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const d = (fbm(x * freq + seed, y * freq + seed * 1.7, z * freq - seed) - 0.5) * 2 * amp;
    if (mode === 'radial') { d3.set(x, y, z); if (d3.lengthSq() < 1e-8) d3.fromBufferAttribute(n, i); d3.normalize(); }
    else d3.fromBufferAttribute(n, i);
    p.setXYZ(i, x + d3.x * d, y + d3.y * d, z + d3.z * d);
  }
  geo.computeVertexNormals();
  smoothSeams(geo);
  return geo;
}

// ---------- Clay material ----------
const CLAY_DECL = `
varying vec3 vClayPos; varying vec3 vNX; varying vec3 vNY; varying vec3 vNZ;
`;
const CLAY_NOISE = `
uniform float uBump; uniform float uFreq; uniform float uSeed; uniform float uVar;
float ch3(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float cvn(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(ch3(i),ch3(i+vec3(1,0,0)),f.x),mix(ch3(i+vec3(0,1,0)),ch3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(ch3(i+vec3(0,0,1)),ch3(i+vec3(1,0,1)),f.x),mix(ch3(i+vec3(0,1,1)),ch3(i+vec3(1,1,1)),f.x),f.y),f.z); }
float clayH(vec3 p, vec3 q){
  float h = cvn(p*4.0)*0.45 + cvn(p*11.0)*0.28 + cvn(p*29.0)*0.10;
  // thumb prints pressed into the clay
  vec3 c1 = vec3(0.42,0.52,0.74); float d1 = length(q-c1);
  h += sin(d1*150.0)*0.045*smoothstep(0.30,0.0,d1);
  vec3 c2 = vec3(-0.62,-0.18,0.72); float d2 = length(q-c2);
  h += sin(d2*160.0)*0.04*smoothstep(0.24,0.0,d2);
  vec3 c3 = vec3(0.1,0.9,-0.4); float d3 = length(q-c3);
  h += sin(d3*140.0)*0.04*smoothstep(0.26,0.0,d3);
  // modelling-tool drag marks
  h += smoothstep(0.86,1.0, cvn(vec3(p.x*1.6, p.y*34.0, p.z*1.6)))*0.06;
  return h;
}
`;

const matCache = new Map();
let seedCounter = 0;

// Real-time quality: 'high' = video look (physical + clay bump), 'medium' = standard + bump,
// 'low' = standard, no per-pixel clay noise (fast on older phones).
let QUALITY = 'high';
export function setClayQuality(q) { QUALITY = q; }
export function clearClayCache() { for (const m of matCache.values()) m.dispose(); matCache.clear(); }

export function clay(color, { rough = 0.6, bump = 1.6, freq = 1, sheen = 0.45, gloss = 0, variation = 0.12, env = 0.35 } = {}) {
  const key = [QUALITY, color, rough, bump, freq, sheen, gloss, variation, env].join('|');
  if (matCache.has(key)) return matCache.get(key);
  const c = new THREE.Color(color);
  const args = [color, { rough, bump, freq, sheen, gloss, variation, env }];
  if (QUALITY === 'low') {
    const lm = new THREE.MeshStandardMaterial({ color: c, roughness: Math.max(0.55, rough), metalness: 0, envMapIntensity: env * 1.4 });
    lm.userData.clayArgs = args;
    matCache.set(key, lm);
    return lm;
  }
  const m = QUALITY === 'medium'
    ? new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0, envMapIntensity: env * 1.3 })
    : new THREE.MeshPhysicalMaterial({
      color: c, roughness: rough, metalness: 0,
      sheen, sheenRoughness: 0.75, sheenColor: c.clone().lerp(new THREE.Color('#ffffff'), 0.4),
      clearcoat: gloss, clearcoatRoughness: 0.3, envMapIntensity: env,
    });
  m.userData.clayArgs = args;
  const seed = (seedCounter++ % 17) * 0.731;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uBump: { value: bump }, uFreq: { value: freq }, uSeed: { value: seed }, uVar: { value: variation } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + CLAY_DECL)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vClayPos = position;
        vNX = normalMatrix*vec3(1.0,0.0,0.0); vNY = normalMatrix*vec3(0.0,1.0,0.0); vNZ = normalMatrix*vec3(0.0,0.0,1.0);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + CLAY_DECL + CLAY_NOISE)
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= 1.0 - uVar*0.5 + uVar*cvn(vClayPos*uFreq*2.3 + uSeed);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { vec3 q = vClayPos*uFreq; vec3 cp = q + uSeed; float e = 0.003; float h0 = clayH(cp,q);
          vec3 g = vec3(clayH(cp+vec3(e,0.,0.),q+vec3(e,0.,0.))-h0, clayH(cp+vec3(0.,e,0.),q+vec3(0.,e,0.))-h0, clayH(cp+vec3(0.,0.,e),q+vec3(0.,0.,e))-h0)/e;
          vec3 gv = g.x*vNX + g.y*vNY + g.z*vNZ;
          normal = normalize(normal - gv*uBump*0.012); }`);
  };
  matCache.set(key, m);
  return m;
}

export function glow(color, intensity = 2) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.35 });
}

// ---------- Mesh helpers ----------
export function mesh(geo, mat, { p = [0, 0, 0], s = 1, r = [0, 0, 0] } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...p);
  if (typeof s === 'number') m.scale.setScalar(s); else m.scale.set(...s);
  m.rotation.set(...r);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function sphere(r, { ws = 48, hs = 32, amp = 0.025, seed = 0 } = {}) {
  return lumpy(new THREE.SphereGeometry(r, ws, hs), { amp: amp * r, freq: 2.0 / r, seed });
}

// Capsule "clay roll" between two points (arms, legs, stems, brows).
export function limb(a, b, r, mat, { amp = 0.02 } = {}) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = Math.max(0.001, dir.length());
  const g = lumpy(new THREE.CapsuleGeometry(r, len, 8, 20), { amp: amp * r * 3, freq: 2.5 / Math.max(r, 0.1) });
  const m = new THREE.Mesh(g, mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

let FONT = null;
export function setFont(f) { FONT = f; }
export function text3d(str, { size = 0.5, depth = 0.14, color = '#FFD25A', bevel = 0.035 } = {}) {
  const g = new TextGeometry(str, {
    font: FONT, size, height: depth, curveSegments: 10,
    bevelEnabled: true, bevelThickness: bevel * 1.4, bevelSize: bevel, bevelSegments: 5,
  });
  g.computeBoundingBox(); g.center();
  return mesh(g, clay(color, { bump: 0.8, freq: 2 }));
}

export function starShape(outer = 1, inner = 0.45, points = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i <= points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  return s;
}

export function clayStar(size, color) {
  const g = new THREE.ExtrudeGeometry(starShape(size, size * 0.48), {
    depth: size * 0.25, bevelEnabled: true, bevelThickness: size * 0.12, bevelSize: size * 0.1, bevelSegments: 5,
  });
  g.center();
  return mesh(g, clay(color, { bump: 1.2, freq: 1 / size }));
}
