// The sky over Wake Racers: a dome painted in one pass — the world mood's gradient from zenith to horizon, a sun (or
// moon) with a soft glow, drifting clouds (lit on the sun side, shaded beneath), stars and a moving aurora at night,
// and lightning flashes in a storm. On phones the clouds use fewer noise octaves. It follows the camera, so it never
// clips, and the fog meets it at the horizon.
import * as THREE from "three";
import type { Mood } from "../worlds";
import type { Quality } from "@/lib/perf";

const VERT = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * 0.99999; }`;
const FRAG = (oct: number) => `
uniform vec3 uTop, uHorizon, uLow, uSun, uCloud, uCloudShade; uniform vec3 uSunDir;
uniform float uSunSize, uClouds, uStars, uAurora, uTime, uFlash, uNight;
varying vec3 vDir;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < ${oct}; i++){ s += a * vn(p); p *= 2.07; a *= 0.5; } return s; }
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 c = h > 0.0 ? mix(uHorizon, uTop, pow(smoothstep(0.0, 0.85, h), 0.7)) : mix(uHorizon, uLow, smoothstep(0.0, -0.12, h));
  // sun / moon
  float sd = max(dot(d, uSunDir), 0.0);
  c += uSun * (smoothstep(1.0 - 0.0009 * uSunSize, 1.0 - 0.0004 * uSunSize, sd) * 1.6 + pow(sd, 260.0 / uSunSize) * 0.55 + pow(sd, 10.0) * 0.18 * (1.0 - uNight * 0.6));
  // stars
  if (uStars > 0.01 && h > 0.02) {
    vec2 sp = d.xz / (d.y + 0.6) * 140.0;
    float st = h21(floor(sp)); float tw = 0.6 + 0.4 * sin(uTime * 3.0 + st * 40.0);
    c += vec3(step(0.9965, st) * tw * uStars * smoothstep(0.02, 0.3, h));
  }
  // aurora: soft moving curtains
  if (uAurora > 0.01 && h > 0.05) {
    vec2 ap = d.xz / (d.y + 0.35);
    float band = fbm(vec2(ap.x * 1.3 + uTime * 0.03, ap.y * 0.4)) ;
    float curtain = smoothstep(0.45, 0.75, band) * smoothstep(0.05, 0.35, h) * smoothstep(0.9, 0.4, h);
    c += mix(vec3(0.1, 0.9, 0.55), vec3(0.6, 0.3, 1.0), smoothstep(0.2, 0.6, h)) * curtain * uAurora * 0.9;
  }
  // clouds on a high plane
  if (uClouds > 0.01 && h > 0.0) {
    vec2 cp = d.xz / (d.y + 0.12) * 1.6 + vec2(uTime * 0.004, uTime * 0.002);
    float n = fbm(cp);
    float cover = smoothstep(1.0 - uClouds * 0.85, 1.05 - uClouds * 0.5, n);
    float lit = clamp(0.55 + 0.6 * dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(uSunDir.x, 0.0, uSunDir.z))) * 0.5 + (fbm(cp * 2.3 + 3.1) - 0.5) * 0.8, 0.0, 1.0);
    vec3 cc = mix(uCloudShade, uCloud, lit);
    c = mix(c, cc, cover * smoothstep(0.0, 0.12, h) * 0.95);
  }
  c += vec3(0.75, 0.8, 1.0) * uFlash;
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Sky {
  readonly mesh: THREE.Mesh;
  readonly mat: THREE.ShaderMaterial;
  constructor(quality: Quality) {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG(quality === "low" ? 2 : quality === "medium" ? 3 : 4),
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      uniforms: {
        uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uLow: { value: new THREE.Color() }, uSun: { value: new THREE.Color() },
        uCloud: { value: new THREE.Color() }, uCloudShade: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 0.5, 1) },
        uSunSize: { value: 1 }, uClouds: { value: 0.3 }, uStars: { value: 0 }, uAurora: { value: 0 }, uTime: { value: 0 }, uFlash: { value: 0 }, uNight: { value: 0 },
      },
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, quality === "low" ? 24 : 40, quality === "low" ? 12 : 20), this.mat);
    this.mesh.renderOrder = -100;
    this.mesh.frustumCulled = false;
  }
  /** set the mood; sunAz is relative to the course's main direction (heading 0 = +z) */
  setMood(m: Mood, sunDir: THREE.Vector3, twistNight: boolean) {
    const u = this.mat.uniforms;
    u.uTop.value.set(m.top); u.uHorizon.value.set(m.horizon); u.uLow.value.set(m.low); u.uSun.value.set(m.sun);
    u.uCloud.value.set(m.cloud); u.uCloudShade.value.set(m.cloudShade);
    u.uSunDir.value.copy(sunDir);
    u.uSunSize.value = m.sunSize; u.uClouds.value = m.clouds; u.uStars.value = twistNight ? 1 : m.stars; u.uAurora.value = m.aurora; u.uNight.value = twistNight ? 1 : m.night;
    if (twistNight) { u.uTop.value.multiplyScalar(0.25); u.uHorizon.value.multiplyScalar(0.35); u.uLow.value.multiplyScalar(0.3); u.uCloud.value.multiplyScalar(0.3); u.uCloudShade.value.multiplyScalar(0.2); }
  }
  update(t: number, camPos: THREE.Vector3, flash: number) {
    this.mesh.position.copy(camPos);
    this.mat.uniforms.uTime.value = t;
    this.mat.uniforms.uFlash.value = flash;
  }
  dispose() { this.mesh.geometry.dispose(); this.mat.dispose(); }
}
