// Weather & ambient particles. Everything is animated in the vertex shader (world-anchored particles that wrap
// inside a box around the camera), so there is no per-frame CPU work or buffer upload. Particles fade out very
// close to the camera to avoid big transparent sprites (overdraw) on phones.
import * as THREE from "three";
import type { GfxQuality, Weather } from "../types";
import type { ThemeLook } from "./themes";
import * as TX from "./textures";

type Kind = Exclude<Weather, "clear"> | "bubbles" | "embers" | "sparkles" | "dust";
interface Cfg { n: [number, number, number]; colors: string[]; size: number; vel: [number, number, number]; drift: number; opacity: number; sprite: "dot" | "petal" | "bubble"; additive?: boolean; box: [number, number, number]; spin?: boolean }

const CFG: Record<Kind, Cfg> = {
  rain: { n: [500, 1100, 2200], colors: ["#AFC6E8"], size: 0, vel: [1.5, -32, 0.8], drift: 0, opacity: 0.45, sprite: "dot", box: [60, 34, 60] },
  snow: { n: [380, 850, 1700], colors: ["#FFFFFF"], size: 0.16, vel: [0.6, -2.6, 0.3], drift: 1.1, opacity: 0.95, sprite: "dot", box: [56, 30, 56] },
  sand: { n: [300, 650, 1300], colors: ["#E9C48A", "#D9AE74"], size: 0.09, vel: [9, -0.4, 3], drift: 1.6, opacity: 0.55, sprite: "dot", box: [56, 22, 56] },
  fireflies: { n: [90, 200, 360], colors: ["#FFF27A", "#B6FF8A"], size: 0.22, vel: [0, 0.15, 0], drift: 1.6, opacity: 1, sprite: "dot", additive: true, box: [70, 14, 70] },
  ash: { n: [260, 600, 1100], colors: ["#8A8088", "#5A5258"], size: 0.12, vel: [0.8, -1.8, 0.4], drift: 1.2, opacity: 0.8, sprite: "dot", box: [56, 28, 56] },
  leaves: { n: [110, 240, 460], colors: ["#E0702A", "#D9452B", "#F2B134", "#A33A22"], size: 0.42, vel: [1.6, -1.7, 0.6], drift: 1.8, opacity: 1, sprite: "petal", box: [50, 24, 50], spin: true },
  petals: { n: [130, 280, 520], colors: ["#FFB7D5", "#FFD1E6", "#FFFFFF"], size: 0.3, vel: [1.2, -1.2, 0.5], drift: 1.6, opacity: 1, sprite: "petal", box: [50, 22, 50], spin: true },
  bubbles: { n: [90, 200, 380], colors: ["#DFFBFF"], size: 0.35, vel: [0, 1.6, 0], drift: 0.6, opacity: 0.8, sprite: "bubble", box: [56, 26, 56] },
  embers: { n: [110, 240, 460], colors: ["#FF8A30", "#FFC04A", "#FF5A1F"], size: 0.12, vel: [0.4, 2.2, 0.2], drift: 1.3, opacity: 1, sprite: "dot", additive: true, box: [60, 26, 60] },
  sparkles: { n: [80, 170, 320], colors: ["#FFFFFF", "#BFF0FF"], size: 0.1, vel: [0.2, -0.3, 0.1], drift: 0.8, opacity: 1, sprite: "dot", additive: true, box: [50, 18, 50] },
  dust: { n: [120, 260, 520], colors: ["#D9B08A", "#C9A07A"], size: 0.08, vel: [3.5, 0.1, 1.2], drift: 1.4, opacity: 0.45, sprite: "dot", box: [60, 18, 60] },
};

const PTS_VERT = `
attribute vec4 aSeed;
uniform float time; uniform vec3 center; uniform vec3 box; uniform vec3 vel; uniform float drift; uniform float size; uniform float pixel;
uniform vec3 c0; uniform vec3 c1; uniform vec3 c2; uniform vec3 c3;
varying float vA; varying vec3 vCol; varying float vRot;
void main(){
  vec3 p = aSeed.xyz * box;
  float sp = 0.7 + aSeed.w * 0.6;
  p += vel * time * sp;
  p.x += sin(time * 0.9 + aSeed.z * 40.0) * drift;
  p.z += cos(time * 0.7 + aSeed.x * 40.0) * drift;
  p.y += sin(time * 1.3 + aSeed.y * 30.0) * drift * 0.3;
  p = mod(p - center + box * 0.5, box) - box * 0.5 + center;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = -mv.z;
  vA = smoothstep(1.2, 4.0, dist) * (1.0 - smoothstep(box.x * 0.3, box.x * 0.5, dist));
  float ci = floor(aSeed.w * 3.999);
  vCol = ci < 1.0 ? c0 : ci < 2.0 ? c1 : ci < 3.0 ? c2 : c3;
  vRot = time * (0.5 + aSeed.x * 2.0) + aSeed.y * 6.28;
  gl_PointSize = min(size * pixel / max(dist, 0.1), 26.0);
  gl_Position = projectionMatrix * mv;
}`;
const PTS_FRAG = `
uniform sampler2D map; uniform float opacity; uniform float spin;
varying float vA; varying vec3 vCol; varying float vRot;
void main(){
  vec2 uv = gl_PointCoord - 0.5;
  if (spin > 0.5) { float c = cos(vRot), s = sin(vRot); uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y); }
  vec4 t = texture2D(map, uv + 0.5);
  float a = t.a * vA * opacity;
  if (a < 0.02) discard;
  gl_FragColor = vec4(vCol * t.rgb, a);
  #include <colorspace_fragment>
}`;
const RAIN_VERT = `
attribute vec4 aSeed; attribute float aEnd;
uniform float time; uniform vec3 center; uniform vec3 box; uniform vec3 vel;
varying float vA;
void main(){
  vec3 p = aSeed.xyz * box;
  p += vel * time * (0.8 + aSeed.w * 0.4);
  p = mod(p - center + box * 0.5, box) - box * 0.5 + center;
  p -= normalize(vel) * aEnd * (0.6 + aSeed.w * 0.6);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = -mv.z;
  vA = smoothstep(0.8, 3.0, dist) * (1.0 - smoothstep(box.x * 0.3, box.x * 0.5, dist)) * (1.0 - aEnd * 0.7);
  gl_Position = projectionMatrix * mv;
}`;
const RAIN_FRAG = `uniform vec3 color; uniform float opacity; varying float vA;
void main(){
  gl_FragColor = vec4(color, vA * opacity);
  #include <colorspace_fragment>
}`;

export interface Particles { obj: THREE.Object3D; update(dt: number, cam: THREE.Vector3, pixel: number): void; dispose(): void }

export function particles(kind: Kind, q: GfxQuality, l: ThemeLook): Particles {
  const c = CFG[kind];
  const n = c.n[q === "low" ? 0 : q === "medium" ? 1 : 2];
  const colors = (kind === "leaves" || kind === "petals") && l.particles?.length ? l.particles : c.colors;
  const seeds = new Float32Array(n * 4);
  for (let i = 0; i < n * 4; i++) seeds[i] = Math.random();
  const g = new THREE.BufferGeometry();
  let obj: THREE.Object3D, mat: THREE.ShaderMaterial;
  const center = new THREE.Vector3(), box = new THREE.Vector3(...c.box);
  if (kind === "rain") {
    const s2 = new Float32Array(n * 8), end = new Float32Array(n * 2), pos = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) { for (let k = 0; k < 4; k++) { s2[i * 8 + k] = seeds[i * 4 + k]; s2[i * 8 + 4 + k] = seeds[i * 4 + k]; } end[i * 2 + 1] = 1; }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(s2, 4));
    g.setAttribute("aEnd", new THREE.BufferAttribute(end, 1));
    mat = new THREE.ShaderMaterial({ uniforms: { time: { value: 0 }, center: { value: center }, box: { value: box }, vel: { value: new THREE.Vector3(...c.vel) }, color: { value: new THREE.Color(colors[0]) }, opacity: { value: c.opacity } }, vertexShader: RAIN_VERT, fragmentShader: RAIN_FRAG, transparent: true, depthWrite: false });
    obj = new THREE.LineSegments(g, mat);
  } else {
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));
    const cols = [0, 1, 2, 3].map((i) => new THREE.Color(colors[i % colors.length]));
    const map = c.sprite === "petal" ? TX.petalSprite() : c.sprite === "bubble" ? TX.bubbleSprite() : TX.softDot();
    mat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, center: { value: center }, box: { value: box }, vel: { value: new THREE.Vector3(...c.vel) }, drift: { value: c.drift }, size: { value: c.size }, pixel: { value: 600 }, c0: { value: cols[0] }, c1: { value: cols[1] }, c2: { value: cols[2] }, c3: { value: cols[3] }, map: { value: map }, opacity: { value: c.opacity }, spin: { value: c.spin ? 1 : 0 } },
      vertexShader: PTS_VERT, fragmentShader: PTS_FRAG, transparent: true, depthWrite: false, blending: c.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    obj = new THREE.Points(g, mat);
  }
  obj.frustumCulled = false;
  obj.renderOrder = 5;
  let t = 0;
  return {
    obj,
    update(dt, cam, pixel) {
      t += dt;
      mat.uniforms.time.value = t;
      center.copy(cam);
      if (mat.uniforms.pixel) mat.uniforms.pixel.value = pixel;
    },
    dispose() { g.dispose(); mat.dispose(); },
  };
}
