// Clay-toy models for Momo Sky Roll, built in code (no assets to download): rounded grass tiles with soil sides,
// garden props, Momo's ball with his sprout, mallets, daisy spinners, Kranky and his claw, arches and clouds.
// Props carry vertex colours + a per-vertex "tint" mask so one instanced mesh can be recoloured per mood.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { propGeometry } from "./art/props";
import { DAISY_CORE_R, MALLET_HEAD_HALF, MALLET_HEAD_R } from "./hazards";

// ---------------------------------------------------------------- shader snippets
const NOISE = /* glsl */ `
float rh(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(rh(i + vec3(0,0,0)), rh(i + vec3(1,0,0)), f.x), mix(rh(i + vec3(0,1,0)), rh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(rh(i + vec3(0,0,1)), rh(i + vec3(1,0,1)), f.x), mix(rh(i + vec3(0,1,1)), rh(i + vec3(1,1,1)), f.x), f.y), f.z);
}`;

export interface ClayUniforms { uPulse: { value: number }; uNight: { value: number } }

/** grass-top tiles: instance colour = grass, `aSide` = soil, `aGlow` = beat-pulse glow (pads, boosts, checkpoints) */
export function tileMaterial(u: ClayUniforms) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.86, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uPulse = u.uPulse;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>
attribute float aTop; attribute vec3 aSide; attribute float aGlow;
varying float vTop; varying vec3 vSide; varying float vGlow; varying vec3 vWPos;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
vTop = aTop; vSide = aSide; vGlow = aGlow;
vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
uniform float uPulse; varying float vTop; varying vec3 vSide; varying float vGlow; varying vec3 vWPos;
${NOISE}`)
      .replace("#include <color_fragment>", `
vec3 topC = vColor;
float n = vnoise(vWPos * 3.3) * 0.65 + vnoise(vWPos * 9.0) * 0.35;
vec3 base = mix(vSide * (0.88 + 0.1 * smoothstep(-0.44, -0.05, vWPos.y)), topC, vTop);
base *= 0.9 + 0.17 * n;
diffuseColor.rgb *= base;`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
totalEmissiveRadiance += topC * vGlow * vTop * (0.22 + 0.35 * uPulse);`);
  };
  return m;
}

/** props: vertex colour where the tint mask is 0, instance colour where it is 1; `aGlow` glows at night */
export function propMaterial(u: ClayUniforms) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, vertexColors: true });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = u.uNight;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>
attribute float aTint; attribute float aGlow; varying float vTint; varying float vPGlow; varying vec3 vBase; varying vec3 vWPos2;`)
      .replace("#include <color_vertex>", `#include <color_vertex>
vTint = aTint; vPGlow = aGlow; vBase = color.rgb;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
vWPos2 = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
uniform float uNight; varying float vTint; varying float vPGlow; varying vec3 vBase; varying vec3 vWPos2;
${NOISE}`)
      .replace("#include <color_fragment>", `
vec3 pc = mix(vBase, vColor, vTint);
pc *= 0.9 + 0.16 * vnoise(vWPos2 * 4.0);
diffuseColor.rgb *= pc;`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
totalEmissiveRadiance += pc * vPGlow * (0.35 + 1.4 * uNight);`);
  };
  return m;
}

// ---------------------------------------------------------------- geometry helpers
export function tileGeometry() {
  const g = new RoundedBoxGeometry(0.96, 0.46, 0.96, 2, 0.1);
  g.translate(0, -0.23, 0);
  const p = g.attributes.position, n = p.count;
  const top = new Float32Array(n);
  for (let i = 0; i < n; i++) { const y = p.getY(i); top[i] = Math.min(1, Math.max(0, (y + 0.1) / 0.07)); }
  g.setAttribute("aTop", new THREE.BufferAttribute(top, 1));
  return g;
}

// ---------------------------------------------------------------- textures
function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return [c, c.getContext("2d")!] as const;
}

export function ballTexture(base = "#ff8a3d") {
  const [c, g] = canvas(256, 128);
  g.fillStyle = base; g.fillRect(0, 0, 256, 128);
  // soft clay bands so you can see Momo rolling
  g.globalAlpha = 0.22; g.fillStyle = "#ffffff";
  for (const y of [22, 96]) { g.beginPath(); g.ellipse(128, y, 160, 9, 0, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 0.18; g.fillStyle = "#b8481a";
  for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(i * 32 + 16, 64, 7, 0, Math.PI * 2); g.fill(); }
  // speckles + thumbprints
  for (let i = 0; i < 420; i++) {
    g.globalAlpha = 0.05 + Math.random() * 0.08;
    g.fillStyle = Math.random() < 0.5 ? "#fff3e0" : "#9a3a10";
    g.beginPath(); g.arc(Math.random() * 256, Math.random() * 128, 0.6 + Math.random() * 1.8, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export function decalTexture(kind: "boost" | "pad" | "crack" | "check" | "warn" | "shadow" | "glow") {
  const [c, g] = canvas(128, 128);
  g.clearRect(0, 0, 128, 128);
  g.lineCap = "round"; g.lineJoin = "round";
  if (kind === "boost") {
    g.strokeStyle = "rgba(255,255,255,0.95)"; g.lineWidth = 13;
    for (const y of [92, 56]) { g.beginPath(); g.moveTo(30, y + 18); g.lineTo(64, y - 16); g.lineTo(98, y + 18); g.stroke(); }
  } else if (kind === "pad") {
    g.strokeStyle = "rgba(255,255,255,0.95)"; g.lineWidth = 9;
    g.beginPath(); g.arc(64, 64, 44, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 11; g.beginPath(); g.moveTo(40, 78); g.lineTo(64, 44); g.lineTo(88, 78); g.stroke();
  } else if (kind === "crack") {
    g.strokeStyle = "rgba(60,30,10,0.8)"; g.lineWidth = 5;
    for (let i = 0; i < 4; i++) {
      g.beginPath(); let x = 64, y = 64; g.moveTo(x, y);
      const a0 = (i / 4) * Math.PI * 2 + 0.4;
      for (let k = 0; k < 4; k++) { x += Math.cos(a0 + (k % 2 ? 0.5 : -0.4)) * 14; y += Math.sin(a0 + (k % 2 ? 0.5 : -0.4)) * 14; g.lineTo(x, y); }
      g.stroke();
    }
  } else if (kind === "check") {
    g.fillStyle = "rgba(255,255,255,0.95)";
    g.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 20 : 44, a = -Math.PI / 2 + (i / 10) * Math.PI * 2; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); }
    g.closePath(); g.fill();
  } else if (kind === "warn") {
    const gr = g.createRadialGradient(64, 64, 10, 64, 64, 62);
    gr.addColorStop(0, "rgba(255,60,60,0.0)"); gr.addColorStop(0.55, "rgba(255,70,70,0.55)"); gr.addColorStop(0.8, "rgba(255,40,40,0.95)"); gr.addColorStop(1, "rgba(255,40,40,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 8;
    g.beginPath(); g.moveTo(64, 34); g.lineTo(64, 74); g.stroke();
    g.beginPath(); g.arc(64, 92, 5, 0, Math.PI * 2); g.fillStyle = "white"; g.fill();
  } else if (kind === "shadow") {
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, "rgba(20,10,30,0.55)"); gr.addColorStop(0.6, "rgba(20,10,30,0.25)"); gr.addColorStop(1, "rgba(20,10,30,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  } else {
    const gr = g.createRadialGradient(64, 64, 2, 64, 64, 62);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.3, "rgba(255,255,255,0.5)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function pill(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const r = h / 2;
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  g.lineTo(x + r, y + h); g.arc(x + r, y + r, r, Math.PI / 2, (Math.PI * 3) / 2); g.closePath();
}

export function bannerTexture(text: string, bg: string, fg = "#ffffff", checker = false) {
  const [c, g] = canvas(512, 128);
  if (checker) {
    for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? "#1a1033" : "#ffffff"; g.fillRect(x * 32, y * 32, 32, 32); }
    g.fillStyle = "rgba(255,138,61,0.92)"; pill(g, 70, 18, 372, 92); g.fill();
  } else {
    g.fillStyle = bg; pill(g, 4, 4, 504, 120); g.fill();
  }
  g.font = "900 70px 'Lilita One', 'Fredoka', system-ui, sans-serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.lineWidth = 10; g.strokeStyle = "rgba(40,20,60,0.55)"; g.strokeText(text, 256, 68);
  g.fillStyle = fg; g.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------- characters & hazards
const std = (color: number, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0, ...o });

export function makeBall() {
  const g = new THREE.Group();
  const tex = ballTexture();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 36, 26), std(0xffffff, { map: tex, roughness: 0.5, emissive: 0xff6a1a, emissiveIntensity: 0.32 }));
  g.add(body);
  // the sprout stays upright on top of the rolling ball
  const sprout = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.2, 6), std(0x3f9e3a));
  stem.position.y = 0.1;
  const leafG = new THREE.SphereGeometry(0.075, 10, 6);
  const leafM = std(0x5fd14a, { roughness: 0.5 });
  const l1 = new THREE.Mesh(leafG, leafM); l1.scale.set(1.5, 0.35, 0.8); l1.position.set(0.08, 0.21, 0); l1.rotation.z = 0.5;
  const l2 = new THREE.Mesh(leafG, leafM); l2.scale.set(1.5, 0.35, 0.8); l2.position.set(-0.08, 0.2, 0); l2.rotation.z = -0.5;
  sprout.add(stem, l1, l2);
  return { group: g, body, sprout };
}

export function makeMallet() {
  const g = new THREE.Group();
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 6), std(0xe8d2a8));
  const head = new THREE.Group();
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(MALLET_HEAD_R, MALLET_HEAD_R, MALLET_HEAD_HALF * 2, 22), std(0xe8504f, { roughness: 0.5 }));
  cyl.rotation.x = Math.PI / 2;
  const band = std(0xfff1d6);
  for (const z of [-0.3, 0.3]) {
    const b = new THREE.Mesh(new THREE.TorusGeometry(MALLET_HEAD_R + 0.01, 0.045, 8, 22), band);
    b.position.z = z; head.add(b);
  }
  const cap = new THREE.Mesh(new THREE.SphereGeometry(MALLET_HEAD_R * 0.98, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(0xd23f3f));
  cap.rotation.x = Math.PI / 2; cap.position.z = MALLET_HEAD_HALF; cap.scale.set(1, 1, 0.25);
  const cap2 = cap.clone(); cap2.rotation.x = -Math.PI / 2; cap2.position.z = -MALLET_HEAD_HALF;
  head.add(cyl, cap, cap2);
  const cloud = new THREE.Mesh(propGeometry("cloud"), std(0xffffff, { vertexColors: true, roughness: 0.9 }));
  cloud.scale.setScalar(0.9);
  g.add(rope, head, cloud);
  return { group: g, rope, head, cloud };
}

export function makeDaisy(size: number) {
  const g = new THREE.Group();
  const spin = new THREE.Group();
  const petal = new THREE.SphereGeometry(1, 18, 10);
  const pm = std(0xffffff, { roughness: 0.55 });
  const tip = std(0xff8ac8, { roughness: 0.55 });
  const arms: THREE.Mesh[] = [];
  for (let k = 0; k < 4; k++) {
    const arm = new THREE.Group();
    // a petal from the core out to `size` (matches the collision capsule)
    const p = new THREE.Mesh(petal, pm);
    p.scale.set(size / 2, 0.17, 0.23);
    p.position.set(size / 2, 0.3, 0);
    arm.add(p);
    const t = new THREE.Mesh(petal, tip);
    t.scale.set(0.24, 0.17, 0.22);
    t.position.set(size - 0.2, 0.31, 0);
    arm.add(t);
    arm.rotation.y = (k * Math.PI) / 2;
    spin.add(arm);
    arms.push(p, t);
  }
  const core = new THREE.Mesh(new THREE.CylinderGeometry(DAISY_CORE_R, DAISY_CORE_R * 1.05, 0.42, 20), std(0xffc93c, { roughness: 0.5 }));
  core.position.y = 0.21;
  const eyeM = std(0x2a1a3a, { roughness: 0.3 });
  const eyes = new THREE.Group();
  for (const x of [-0.15, 0.15]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), eyeM); e.position.set(x, 0.43, 0.12); e.scale.y = 1.3; eyes.add(e); }
  const cheek = std(0xff7a8a);
  for (const x of [-0.3, 0.3]) { const ch = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), cheek); ch.position.set(x, 0.4, 0.2); ch.scale.set(1, 0.4, 1); eyes.add(ch); }
  g.add(spin, core, eyes);
  return { group: g, spin, arms };
}

export function makeClaw() {
  const g = new THREE.Group();
  const red = std(0xe8504f, { roughness: 0.45 });
  const dark = std(0xb83a3a, { roughness: 0.5 });
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 3.2, 12), red);
  arm.position.y = 2.6;
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.75, 18, 12), red);
  palm.scale.set(1.25, 0.8, 1); palm.position.y = 0.95;
  const upper = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 10), dark);
  upper.scale.set(1.6, 0.45, 0.8); upper.position.set(-0.55, 0.35, 0);
  const lower = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10), red);
  lower.scale.set(1.5, 0.42, 0.75); lower.position.set(0.6, 0.3, 0);
  g.add(arm, palm, upper, lower);
  return { group: g, upper, lower };
}

export function makeKranky() {
  const g = new THREE.Group();
  const red = std(0xe8504f, { roughness: 0.45 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 16), red);
  body.scale.set(1.35, 0.85, 1); body.position.y = 0.85;
  const white = std(0xffffff, { roughness: 0.3 }), black = std(0x1a1030, { roughness: 0.3 });
  const eyes = new THREE.Group();
  for (const x of [-0.38, 0.38]) {
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.6, 8), red); stalk.position.set(x, 1.75, -0.35);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), white); eye.position.set(x, 2.1, -0.38);
    const pup = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), black); pup.position.set(x * 0.92, 2.1, -0.58);
    eyes.add(stalk, eye, pup);
  }
  const hat = new THREE.Group();
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 20), black);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.7, 20), black); top.position.y = 0.36;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.455, 0.46, 0.12, 20), std(0xffc93c)); band.position.y = 0.1;
  hat.add(brim, top, band); hat.position.set(0, 1.55, 0.05); hat.rotation.z = 0.12;
  const claws: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const c = new THREE.Group();
    const a = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), red); a.scale.set(1.5, 0.5, 0.75); a.position.set(0, 0.12, 0);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), std(0xc94343)); b.scale.set(1.4, 0.45, 0.7); b.position.set(0, -0.12, 0);
    c.add(a, b);
    c.position.set(side * 1.55, 1.0, -0.6);
    c.rotation.y = side * 0.5;
    g.add(c); claws.push(c);
  }
  const legM = std(0xc94343);
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? -1 : 1, k = i % 3;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.8, 6), legM);
    leg.position.set(side * (0.9 + k * 0.12), 0.35, -0.3 + k * 0.35); leg.rotation.z = side * 0.9;
    g.add(leg);
  }
  g.add(body, eyes, hat);
  return { group: g, claws, eyes, hat };
}

export function makeArch(width: number, label: THREE.Texture, colors: [number, number], big = false) {
  const g = new THREE.Group();
  const h = big ? 2.8 : 2.1;
  const postM = std(colors[0], { roughness: 0.5 });
  const half = width / 2 + 0.45;
  for (const x of [-half, half]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, h, 10), postM);
    p.position.set(x, h / 2 - 0.1, 0); g.add(p);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), std(colors[1], { roughness: 0.4 }));
    knob.position.set(x, h, 0); g.add(knob);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, half * 2, 10), postM);
  bar.rotation.z = Math.PI / 2; bar.position.y = h - 0.15; g.add(bar);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(3.6, half * 1.7), Math.min(3.6, half * 1.7) / 4), new THREE.MeshBasicMaterial({ map: label, transparent: true, side: THREE.DoubleSide, fog: false }));
  sign.position.set(0, h + 0.38, 0.02); g.add(sign);
  g.userData.sign = sign; g.userData.signY = h + 0.38;
  // flower garland
  const fm = [std(0xff7aa8), std(0xffd84d), std(0xffffff), std(0xa98bff)];
  const fg = new THREE.SphereGeometry(0.11, 8, 6);
  for (let i = 0; i <= 10; i++) {
    const t = i / 10, x = -half + t * half * 2;
    const f = new THREE.Mesh(fg, fm[i % fm.length]);
    f.position.set(x, h - 0.15 - Math.sin(t * Math.PI) * 0.35, 0.08); g.add(f);
  }
  return g;
}
