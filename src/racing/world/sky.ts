// Sky: the expensive parts (gradient, sun halo, fbm clouds, moon, planets, milky way, underwater surface) are
// rendered ONCE into a cube map at build time; the dome then costs one texture fetch per pixel plus cheap
// twinkling stars. The same cube feeds the PMREM reflections. Auroras are a separate animated ribbon.
import * as THREE from "three";
import type { GfxQuality } from "../types";
import type { ThemeLook } from "./themes";

const NOISE = `
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h12(i), h12(i + vec2(1., 0.)), f.x), mix(h12(i + vec2(0., 1.)), h12(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 6; i++){ s += a * n2(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .5; } return s; }
`;

const BAKE_FRAG = `
uniform vec3 top; uniform vec3 hor; uniform vec3 bot; uniform vec3 sunDir; uniform vec3 sunCol; uniform vec3 cloudCol; uniform vec3 groundCol;
uniform float glow; uniform float clouds; uniform float night; uniform float milky; uniform float underwater; uniform float moonOn; uniform float sunOn;
uniform vec3 moonDir; uniform vec4 planet; uniform vec3 planetCol; uniform vec3 planetCol2;
varying vec3 vDir;
${NOISE}
void main(){
  vec3 d = normalize(vDir); float y = d.y;
  vec3 c = y > 0. ? mix(hor, top, pow(clamp(y, 0., 1.), 0.5)) : mix(hor, bot, pow(clamp(-y, 0., 1.), 0.35));
  c = mix(c, hor * 1.04, exp(-abs(y) * 16.) * 0.35);
  float sd = max(dot(d, sunDir), 0.);
  c += sunCol * (pow(sd, 6.) * glow * 0.28 + pow(sd, 48.) * glow * 0.55) * (1. - underwater * 0.6);
  float vis = 1.0;
  if (milky > 0. && y > 0.) {
    vec3 n = normalize(vec3(0.35, 0.55, 0.75)); float b = exp(-pow(dot(d, n) / 0.17, 2.));
    float f = fbm(vec2(atan(d.z, d.x) * 4., d.y * 7.));
    c += vec3(0.55, 0.62, 0.95) * b * f * f * 0.5 * milky;
  }
  if (underwater > 0.5) {
    float up = smoothstep(0.05, 1.0, y);
    vec2 uv = d.xz / (abs(y) + 0.15) * 3.0;
    float r = fbm(uv * 1.7); float cs = pow(1.0 - abs(r - 0.5) * 2.0, 6.0);
    c = mix(c, vec3(0.78, 0.98, 1.0), up * (0.25 + cs * 0.6));
    c += vec3(0.9, 1.0, 1.0) * smoothstep(0.86, 0.98, y) * 0.8;
  } else if (clouds > 0. && y > 0.) {
    vec2 uv = d.xz / (y + 0.1) * 1.5;
    float nn = fbm(uv * 1.2 + vec2(3.1, 7.7));
    float den = smoothstep(1.02 - clouds * 0.62, 1.22 - clouds * 0.5, nn + 0.18);
    float n2v = fbm(uv * 1.2 + vec2(3.1, 7.7) + sunDir.xz * 0.18);
    float lit = clamp(0.62 + (nn - n2v) * 4.0, 0.0, 1.0);
    vec3 cc = mix(cloudCol * 0.62, cloudCol * 1.05, lit) + sunCol * pow(sd, 5.) * 0.5 * glow;
    den *= smoothstep(0.0, 0.12, y) * 0.95;
    c = mix(c, cc, den);
    vis = 1.0 - den;
  }
  if (sunOn > 0.5) c += sunCol * smoothstep(0.99935, 0.99965, sd) * 7.0 * (1. - underwater);
  if (moonOn > 0.5) {
    float md = dot(d, moonDir);
    float m = smoothstep(0.99905, 0.99925, md);
    vec3 t = normalize(cross(moonDir, vec3(0., 1., 0.))); vec3 b2 = cross(t, moonDir);
    vec2 mp = vec2(dot(d, t), dot(d, b2)) * 400.;
    float cr = n2(mp * 0.8) * 0.3 + n2(mp * 2.1) * 0.15;
    c = mix(c, vec3(1.0, 0.97, 0.9) * (0.8 + cr) * 1.6, m * vis);
    c += vec3(0.55, 0.6, 0.8) * pow(max(md, 0.), 300.) * 0.35 * vis;
  }
  if (planet.w > 0.) {
    float pd = dot(d, planet.xyz); float rr = cos(planet.w);
    float m = smoothstep(rr, rr + 0.00035, pd);
    vec3 t = normalize(cross(planet.xyz, vec3(0., 1., 0.))); vec3 b2 = cross(t, planet.xyz);
    vec2 q = vec2(dot(d, t), dot(d, b2)) / sin(planet.w);
    float qz = sqrt(max(0., 1. - dot(q, q)));
    vec3 nrm = normalize(t * q.x + b2 * q.y - planet.xyz * qz);
    float lam = clamp(dot(nrm, sunDir) + 0.15, 0.0, 1.0);
    float f = fbm(q * 3.0 + 4.0);
    vec3 pc = mix(planetCol, planetCol2, smoothstep(0.45, 0.65, f));
    c = mix(c, pc * (0.06 + lam * 1.1), m);
  }
  c = mix(c, groundCol, smoothstep(-0.02, -0.22, y) * (1.0 - underwater));
  gl_FragColor = vec4(c, vis);
}`;

const DOME_FRAG = `
uniform samplerCube sky; uniform float stars; uniform float time;
varying vec3 vDir;
float h13(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
void main(){
  vec3 d = normalize(vDir);
  vec4 s = textureCube(sky, d);
  vec3 c = s.rgb;
  if (stars > 0.5 && d.y > 0.0) {
    vec3 p = d * 230.0; vec3 i = floor(p); vec3 f = fract(p) - 0.5;
    float h = h13(i);
    float st = step(0.982, h) * smoothstep(0.32, 0.05, length(f));
    float tw = 0.65 + 0.35 * sin(time * (2.0 + h * 3.0) + h * 60.0);
    c += vec3(0.9, 0.95, 1.0) * st * tw * (0.4 + 2.2 * fract(h * 17.3)) * smoothstep(0.0, 0.18, d.y) * s.a;
  }
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const VERT = "varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }";

export interface SkyBuild {
  dome: THREE.Mesh;
  envMap: THREE.Texture;
  aurora: THREE.Mesh | null;
  update(dt: number, focus: THREE.Vector3): void;
  dispose(): void;
}

export function buildSky(l: ThemeLook, night: boolean, renderer: THREE.WebGLRenderer, q: GfxQuality, groundCol: THREE.Color): SkyBuild {
  const col = (c: string) => new THREE.Color(c);
  const sunDir = new THREE.Vector3(...l.sun.dir).normalize();
  const moonDir = new THREE.Vector3(-sunDir.x * 0.6 + 0.3, Math.max(0.35, sunDir.y + 0.15), -sunDir.z * 0.6 - 0.4).normalize();
  const cloudCol = col(l.cloudColor ?? (night ? "#2A3048" : "#FFFFFF"));
  const planetDir = l.planet ? new THREE.Vector3(...l.planet.dir).normalize() : new THREE.Vector3(0, 1, 0);
  const bakeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false,
    uniforms: {
      top: { value: col(l.sky[0]) }, hor: { value: col(l.sky[1]) }, bot: { value: col(l.sky[2]) },
      sunDir: { value: sunDir }, sunCol: { value: col(l.sun.color) }, cloudCol: { value: cloudCol }, groundCol: { value: groundCol },
      glow: { value: l.sun.glow }, clouds: { value: l.clouds ?? 0 }, night: { value: night ? 1 : 0 }, milky: { value: l.milkyWay ? 1 : 0 },
      underwater: { value: l.underwater ? 1 : 0 }, moonOn: { value: l.moon && night ? 1 : 0 }, sunOn: { value: night || l.underwater ? 0 : 1 },
      moonDir: { value: moonDir },
      planet: { value: new THREE.Vector4(planetDir.x, planetDir.y, planetDir.z, l.planet ? l.planet.size : 0) },
      planetCol: { value: col(l.planet?.color ?? "#ffffff") }, planetCol2: { value: col(l.planet?.color2 ?? "#ffffff") },
    },
    vertexShader: VERT, fragmentShader: BAKE_FRAG,
  });
  const size = q === "low" ? 256 : q === "medium" ? 512 : 1024;
  const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const bakeScene = new THREE.Scene();
  const bakeBall = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), bakeMat);
  bakeScene.add(bakeBall);
  const cc = new THREE.CubeCamera(0.1, 100, rt);
  cc.update(renderer, bakeScene);
  bakeBall.geometry.dispose(); bakeMat.dispose();

  const pm = new THREE.PMREMGenerator(renderer);
  const envRT = pm.fromCubemap(rt.texture);
  pm.dispose();

  const domeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sky: { value: rt.texture }, stars: { value: (l.stars ?? night) && night ? 1 : 0 }, time: { value: 0 } },
    vertexShader: VERT, fragmentShader: DOME_FRAG,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), domeMat);
  dome.renderOrder = -10; dome.frustumCulled = false;

  let aurora: THREE.Mesh | null = null;
  let aMat: THREE.ShaderMaterial | null = null;
  if (l.aurora && night) {
    aMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { time: { value: 0 }, c1: { value: col(l.aurora[0]) }, c2: { value: col(l.aurora[1]) } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform float time; uniform vec3 c1; uniform vec3 c2; varying vec2 vUv;
        float h(float x){ return fract(sin(x * 127.1) * 43758.5453); }
        float n1(float x){ float i = floor(x), f = fract(x); f = f * f * (3. - 2. * f); return mix(h(i), h(i + 1.), f); }
        void main(){
          float u = vUv.x * 6.2831853;
          float mask = smoothstep(0.1, 0.7, sin(u * 2.0 + 0.6) * 0.5 + 0.5 + 0.3 * sin(u * 5.0 + time * 0.05));
          float base = 0.18 + 0.1 * sin(u * 3.0 + time * 0.07) + 0.05 * sin(u * 11.0 - time * 0.13);
          float v = vUv.y;
          float vert = smoothstep(base - 0.03, base + 0.02, v) * exp(-max(v - base, 0.) * 3.2);
          float rays = 0.45 + 0.55 * n1(vUv.x * 520.0 + n1(vUv.x * 40.0 + time * 0.25) * 9.0 + time * 0.6);
          vec3 cc = mix(c1, c2, smoothstep(0.05, 0.55, v - base));
          float a = vert * mask * rays * 0.75;
          gl_FragColor = vec4(cc * a, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    aurora = new THREE.Mesh(new THREE.CylinderGeometry(1500, 1500, 1100, 48, 1, true), aMat);
    aurora.renderOrder = -9; aurora.frustumCulled = false;
  }

  let t = 0;
  return {
    dome, envMap: envRT.texture, aurora,
    update(dt, focus) {
      t += dt;
      dome.position.set(focus.x, 0, focus.z);
      domeMat.uniforms.time.value = t;
      if (aurora && aMat) { aurora.position.set(focus.x, focus.y + 520, focus.z); aMat.uniforms.time.value = t; }
    },
    dispose() {
      rt.dispose(); envRT.dispose();
      dome.geometry.dispose(); domeMat.dispose();
      if (aurora) { aurora.geometry.dispose(); aMat?.dispose(); }
    },
  };
}
