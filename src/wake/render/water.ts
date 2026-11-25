// Water for Wake Racers, drawn by one shader everywhere (the lane, the open sea, the far ocean): colour from the real
// depth under it (turquoise shallows, deep blue channels), foam where it meets the land and over rapids, rolling
// waves (calm near the shore, bigger in a storm), fine ripples from a small tiling normal map made once in code,
// the sky's colour reflected at grazing angles, a bright glint of sun or moon, and the world's fog. Phones skip the
// vertex waves and one ripple layer. Plus the waterfall curtain shader.
import * as THREE from "three";
import type { Quality } from "@/lib/perf";
import type { Mood } from "../worlds";
import { fbm } from "../util";

let normalTex: THREE.DataTexture | null = null;
/** a tiling ripple map: rg = normal xz, b = foam noise */
function rippleTexture() {
  if (normalTex) return normalTex;
  const n = 128, h = new Float32Array(n * n), data = new Uint8Array(n * n * 4);
  // tileable noise: sample a torus in 4D-ish by wrapping the coordinates through sin/cos
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const a = (x / n) * Math.PI * 2, b = (y / n) * Math.PI * 2;
    h[y * n + x] = fbm(Math.cos(a) * 2.2 + 10, Math.sin(a) * 2.2 + Math.cos(b) * 2.2 * 0.7, 4, 7) * 0.6 + fbm(Math.sin(b) * 2.2 + 3, Math.cos(b) * 2.2 + Math.sin(a) * 1.5, 4, 11) * 0.4;
  }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const l = h[y * n + ((x + n - 1) % n)], r = h[y * n + ((x + 1) % n)], d = h[((y + n - 1) % n) * n + x], u = h[((y + 1) % n) * n + x];
    const nx = (l - r) * 6, nz = (d - u) * 6;
    const k = (y * n + x) * 4;
    data[k] = Math.round((nx * 0.5 + 0.5) * 255); data[k + 1] = Math.round((nz * 0.5 + 0.5) * 255);
    data[k + 2] = Math.round(h[y * n + x] * 255); data[k + 3] = 255;
  }
  normalTex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  normalTex.wrapS = normalTex.wrapT = THREE.RepeatWrapping;
  normalTex.magFilter = THREE.LinearFilter; normalTex.minFilter = THREE.LinearMipmapLinearFilter; normalTex.generateMipmaps = true;
  normalTex.needsUpdate = true;
  return normalTex;
}

const VERT = (waves: boolean) => `
attribute float aDepth; attribute float aFoam;
uniform float uTime, uWave;
varying vec3 vWorld; varying float vDepth; varying float vFoam; varying vec3 vN;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vec3 n = vec3(0.0, 1.0, 0.0);
  ${waves ? `
  float k = uWave * smoothstep(0.2, 3.5, aDepth);
  float p1 = dot(w.xz, vec2(0.11, 0.07)) + uTime * 1.3, p2 = dot(w.xz, vec2(-0.05, 0.13)) + uTime * 1.05, p3 = dot(w.xz, vec2(0.21, -0.17)) + uTime * 2.1;
  w.y += k * (0.34 * sin(p1) + 0.26 * sin(p2) + 0.1 * sin(p3));
  float dx = k * (0.34 * 0.11 * cos(p1) - 0.26 * 0.05 * cos(p2) + 0.1 * 0.21 * cos(p3));
  float dz = k * (0.34 * 0.07 * cos(p1) + 0.26 * 0.13 * cos(p2) - 0.1 * 0.17 * cos(p3));
  n = normalize(vec3(-dx, 1.0, -dz));` : ``}
  vWorld = w.xyz; vDepth = aDepth; vFoam = aFoam; vN = n;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = (detail: number) => `
uniform vec3 uDeep, uShallow, uFoam, uSkyRefl, uHorizon, uSunColor, uSunDir, uFogColor;
uniform float uFogNear, uFogFar, uTime, uNight, uChop, uGlints;
uniform sampler2D uRipple;
varying vec3 vWorld; varying float vDepth; varying float vFoam; varying vec3 vN;
void main(){
  vec3 V = normalize(cameraPosition - vWorld);
  float dist = length(cameraPosition - vWorld);
  vec2 uv = vWorld.xz * 0.05;
  vec4 r1 = texture2D(uRipple, uv + vec2(uTime * 0.013, uTime * 0.009));
  vec3 N = vN;
  float fade = 1.0 - smoothstep(60.0, 420.0, dist);
  N.xz += (r1.rg * 2.0 - 1.0) * (0.22 + 0.25 * uChop) * fade;
  ${detail > 1 ? `vec4 r2 = texture2D(uRipple, uv * 2.7 - vec2(uTime * 0.021, -uTime * 0.012)); N.xz += (r2.rg * 2.0 - 1.0) * 0.14 * fade;` : `vec4 r2 = r1;`}
  N = normalize(N);
  float ndv = max(dot(N, V), 0.0);
  float fres = 0.03 + 0.97 * pow(1.0 - ndv, 5.0);
  vec3 R = reflect(-V, N);
  vec3 refl = mix(uHorizon, uSkyRefl, smoothstep(0.0, 0.45, R.y));
  vec3 body = mix(uShallow, uDeep, smoothstep(0.4, 7.0, vDepth));
  // light through the shallows: brighter where the ripples focus it
  body *= 0.9 + 0.25 * (r2.b - 0.5) * (1.0 - smoothstep(0.5, 5.0, vDepth));
  vec3 col = mix(body, refl, clamp(fres * 0.9, 0.0, 1.0));
  float sd = max(dot(R, uSunDir), 0.0);
  col += uSunColor * (pow(sd, 260.0) * 3.2 * uGlints + pow(sd, 28.0) * 0.14);
  // foam: the shore line, rapids and storm crests
  float pat = r2.b;
  float shore = 1.0 - smoothstep(0.0, 0.7 + 0.8 * pat, vDepth);
  float churn = vFoam * smoothstep(0.4, 0.7, pat + 0.12 * sin(uTime * 3.0 + vWorld.x * 0.4 + vWorld.z * 0.3));
  float crest = uChop * smoothstep(0.62, 0.72, r1.b) * fade;
  float foam = clamp(shore * (0.5 + 0.5 * pat) + churn + crest, 0.0, 1.0);
  col = mix(col, uFoam * (1.0 - uNight * 0.35), foam * 0.9);
  col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, dist));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function waterMaterial(q: Quality) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT(q !== "low"), fragmentShader: FRAG(q === "low" ? 1 : 2),
    uniforms: {
      uDeep: { value: new THREE.Color() }, uShallow: { value: new THREE.Color() }, uFoam: { value: new THREE.Color() },
      uSkyRefl: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uSunColor: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 0.5, 1) }, uFogColor: { value: new THREE.Color() }, uFogNear: { value: 100 }, uFogFar: { value: 900 },
      uTime: { value: 0 }, uWave: { value: 0.4 }, uNight: { value: 0 }, uChop: { value: 0 }, uGlints: { value: 1 },
      uRipple: { value: rippleTexture() },
    },
  });
}

export function setWaterMood(mat: THREE.ShaderMaterial, m: Mood, sunDir: THREE.Vector3, waves: number, chop: number, fogNear: number, fogFar: number, fog: THREE.Color, night: number) {
  const u = mat.uniforms;
  u.uDeep.value.set(m.water.deep); u.uShallow.value.set(m.water.shallow); u.uFoam.value.set(m.water.foam);
  u.uSkyRefl.value.set(m.water.sky); u.uHorizon.value.set(m.horizon); u.uSunColor.value.set(m.sun);
  if (night > 0.5) u.uSunColor.value.multiplyScalar(0.55);
  u.uSunDir.value.copy(sunDir);
  u.uFogColor.value.copy(fog); u.uFogNear.value = fogNear; u.uFogFar.value = fogFar;
  u.uWave.value = waves; u.uChop.value = chop; u.uNight.value = night;
}

// ------------------------------------------------------------------ waterfalls
const FALL_VERT = `varying vec2 vUv; varying vec3 vWorld; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FALL_FRAG = `
uniform float uTime; uniform vec3 uColor, uFoam, uFogColor; uniform float uFogNear, uFogFar; uniform sampler2D uRipple;
varying vec2 vUv; varying vec3 vWorld;
void main(){
  float streak = texture2D(uRipple, vec2(vUv.x * 3.0, vUv.y * 0.6 + uTime * 1.4)).b;
  float streak2 = texture2D(uRipple, vec2(vUv.x * 7.0 + 0.3, vUv.y * 1.3 + uTime * 2.2)).b;
  float white = smoothstep(0.35, 0.8, streak * 0.6 + streak2 * 0.5) + smoothstep(0.75, 1.0, 1.0 - vUv.y) * 0.9 + smoothstep(0.85, 1.0, vUv.y) * 0.4;
  vec3 c = mix(uColor, uFoam, clamp(white, 0.0, 1.0));
  float dist = length(cameraPosition - vWorld);
  c = mix(c, uFogColor, smoothstep(uFogNear, uFogFar, dist));
  gl_FragColor = vec4(c, 0.92);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
export function fallMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: FALL_VERT, fragmentShader: FALL_FRAG, transparent: true, side: THREE.DoubleSide, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color() }, uFoam: { value: new THREE.Color() }, uFogColor: { value: new THREE.Color() }, uFogNear: { value: 100 }, uFogFar: { value: 900 }, uRipple: { value: rippleTexture() } },
  });
}
