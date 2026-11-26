// Everything around the heist lot, which is most of the picture:
//  - the sky: a gradient dome graded to the time of day (soft morning peach, blue midday, golden hour, violet dusk,
//    deep night), a square pixel sun or a cratered moon, stars at night, the northern lights over the frozen harbour,
//    the Earth hanging over the moon colony, and slow-drifting voxel clouds;
//  - the land beyond the lot: a ground plane (or the sea, a cloud sea) running to the horizon;
//  - each district's big scene, built from voxel blocks in rings far around and fading into the haze: rolling hills
//    with red-brick houses, a water tower and a church spire; striped desert mesas; snowy peaks over a harbour of
//    cranes and ships; a neon skyline; jungle temples and waterfalls; a smoking volcano over the lava works; a pirate
//    cove with a lighthouse and ships; floating cloud isles with airships; blossom hills with pagodas and red gates;
//    moon craters and habitat domes; giant glowing crystal spires; and Baron Bolt's tower city with its red beacons;
//  - the weather: pixel rain, snow, dust, embers, leaves, fireflies, spores, petals and starlight.
// The scenery is one merged, unlit mesh (its light is painted into the blocks), so it costs a couple of draw calls.
import * as THREE from "three";
import type { District, TimeOfDay, Weather } from "../districts";
import { chance, makeRng, mix, pick, range, shade, type Rng } from "../util";
import { Builder, C, pixelTexture } from "./voxel";

/** what the backdrop is built from: the district (and a remix partner), the time, the weather, a seed */
export interface LookIn { district: District; partner: District | null; blendAmt: number; time: TimeOfDay; weather: Weather; seed: number }
export interface Look {
  world: District; partner: District | null;
  sky: [string, string, string]; fog: string; fogNear: number; fogFar: number;
  sun: string; sunDir: THREE.Vector3; sunI: number; hemiSky: string; hemiGround: string; hemiI: number;
  night: number;
  /** the scenery's block colours are multiplied by this (dusk and night dim them) */
  dim: string;
}

const TIME: Record<TimeOfDay, { sky: [string, string, string]; pull: number; sun: string; sunI: number; hemi: number; elev: number; dim: string; night: number }> = {
  morning: { sky: ["#6A98E0", "#C8D8F0", "#FFD8B8"], pull: 0.45, sun: "#FFE2C0", sunI: 1.6, hemi: 1.0, elev: 0.35, dim: "#FFF0E8", night: 0 },
  day: { sky: ["#3E8EE8", "#8CC8F8", "#E2F4FF"], pull: 0, sun: "#FFF8E8", sunI: 2.0, hemi: 1.15, elev: 0.9, dim: "#FFFFFF", night: 0 },
  golden: { sky: ["#4A60B0", "#F0A06C", "#FFD898"], pull: 0.6, sun: "#FFC880", sunI: 1.8, hemi: 0.95, elev: 0.22, dim: "#FFE0C0", night: 0.1 },
  dusk: { sky: ["#232868", "#A85C9C", "#FF9E7C"], pull: 0.7, sun: "#FFA890", sunI: 1.2, hemi: 0.9, elev: 0.08, dim: "#C8A8C8", night: 0.45 },
  night: { sky: ["#060C22", "#10224E", "#22407A"], pull: 0.8, sun: "#BCD6FF", sunI: 1.05, hemi: 0.95, elev: 0.75, dim: "#7A86B8", night: 1 },
};
const OWN_NIGHT = new Set(["neon", "moon", "tower", "lava", "crystal"]);

export function lookFor(plan: LookIn): Look {
  const world = plan.district, partner = plan.partner;
  const b = partner ? plan.blendAmt : 0;
  const P = (a: string, k?: string) => (partner && k ? mix(a, k, b) : a);
  const tm = TIME[plan.time];
  const own = OWN_NIGHT.has(world.id);
  const pull = own ? tm.pull * 0.3 : tm.pull;
  const sky = world.sky.map((c, i) => mix(P(c, partner?.sky[i]), tm.sky[i], pull)) as [string, string, string];
  const fog = mix(P(world.fog, partner?.fog), sky[2], 0.35 + pull * 0.3);
  const az = 0.6 + (plan.seed % 9) * 0.22, el = own && plan.time !== "night" ? 0.5 : tm.elev;
  const sunDir = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el) + 0.15, Math.sin(az) * Math.cos(el)).normalize();
  const night = own ? Math.max(tm.night, world.id === "moon" ? 0.6 : 0.4) : tm.night;
  return {
    world, partner, sky, fog, fogNear: world.id === "moon" ? 70 : 50, fogFar: plan.weather === "dust" || plan.weather === "snow" || plan.weather === "rain" ? 190 : 330,
    sun: mix(world.sun, tm.sun, 0.5), sunDir, sunI: tm.sunI * (own ? 0.85 : 1), hemiSky: mix(P(world.ambient, partner?.ambient), sky[1], 0.4), hemiGround: shade(P(world.palette.top, partner?.palette.top), -0.3), hemiI: tm.hemi,
    night, dim: own ? mix(tm.dim, "#FFFFFF", 0.35) : tm.dim,
  };
}

// ---------------------------------------------------------------- the sky
function skyDome(l: Look) {
  const g = new THREE.SphereGeometry(500, 24, 16);
  const m = new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color(l.sky[0]) }, mid: { value: new THREE.Color(l.sky[1]) }, low: { value: new THREE.Color(l.sky[2]) } },
    vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "uniform vec3 top; uniform vec3 mid; uniform vec3 low; varying vec3 vP; void main(){ float h = clamp(vP.y, -0.2, 1.0); vec3 c = h < 0.12 ? mix(low, mid, smoothstep(-0.05, 0.12, h)) : mix(mid, top, smoothstep(0.12, 0.75, h)); gl_FragColor = vec4(c, 1.0); }",
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  m.toneMapped = false;
  const mesh = new THREE.Mesh(g, m);
  mesh.renderOrder = -10;
  return mesh;
}
/** a square pixel sun with rays, or a cratered moon, painted small and drawn big */
function sunSprite(l: Look, moon: boolean) {
  const cv = document.createElement("canvas"); cv.width = cv.height = 32;
  const c = cv.getContext("2d")!;
  if (moon) {
    c.fillStyle = "rgba(220,230,255,0.25)"; c.fillRect(6, 6, 20, 20);
    c.fillStyle = "#E8ECF8"; c.fillRect(9, 9, 14, 14); c.fillRect(8, 11, 16, 10); c.fillRect(11, 8, 10, 16);
    c.fillStyle = "#B8C0D8"; c.fillRect(12, 12, 3, 3); c.fillRect(17, 16, 3, 2); c.fillRect(14, 19, 2, 2);
  } else {
    c.fillStyle = "rgba(255,240,200,0.35)"; c.fillRect(4, 4, 24, 24);
    c.fillStyle = "rgba(255,240,200,0.5)"; c.fillRect(7, 7, 18, 18);
    c.fillStyle = l.sun; c.fillRect(10, 10, 12, 12); c.fillRect(9, 12, 14, 8); c.fillRect(12, 9, 8, 14);
    c.fillStyle = "#FFFFFF"; c.fillRect(12, 12, 4, 3);
  }
  const t = pixelTexture(cv);
  const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false });
  m.toneMapped = false;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m);
  mesh.scale.setScalar(moon ? 46 : 60);
  mesh.position.copy(l.sunDir).multiplyScalar(420);
  mesh.lookAt(0, 0, 0);
  mesh.renderOrder = -9;
  return mesh;
}
function stars(r: Rng, n: number) {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, e = 0.12 + r() * 1.3; pos[i * 3] = Math.cos(a) * Math.cos(e) * 450; pos[i * 3 + 1] = Math.sin(e) * 450; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 450; }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85, depthWrite: false });
  const p = new THREE.Points(g, m); p.renderOrder = -9;
  return p;
}
/** the Earth, seen from the moon base: a pixel globe */
function earth() {
  const cv = document.createElement("canvas"); cv.width = cv.height = 24;
  const c = cv.getContext("2d")!;
  c.fillStyle = "rgba(120,180,255,0.3)"; c.fillRect(2, 2, 20, 20);
  c.fillStyle = "#2A6AD8"; c.fillRect(5, 4, 14, 16); c.fillRect(4, 6, 16, 12);
  c.fillStyle = "#3EA84A"; c.fillRect(7, 7, 4, 3); c.fillRect(12, 11, 5, 4); c.fillRect(6, 14, 3, 2);
  c.fillStyle = "#FFFFFF"; c.fillRect(9, 5, 5, 1); c.fillRect(13, 9, 4, 1); c.fillRect(6, 17, 6, 1);
  const m = new THREE.MeshBasicMaterial({ map: pixelTexture(cv), transparent: true, depthWrite: false, fog: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m);
  mesh.scale.setScalar(70); mesh.position.set(-160, 230, -330); mesh.lookAt(0, 0, 0); mesh.renderOrder = -9;
  return mesh;
}
/** aurora curtains: soft bands of light */
function aurora() {
  const cv = document.createElement("canvas"); cv.width = 64; cv.height = 32;
  const c = cv.getContext("2d")!;
  for (let x = 0; x < 64; x++) { const h = 10 + Math.round(Math.sin(x * 0.3) * 4 + Math.sin(x * 0.11) * 5); for (let y = 0; y < h; y++) { c.fillStyle = `rgba(${y < h / 2 ? "90,255,176" : "120,200,255"},${0.6 * (1 - y / h)})`; c.fillRect(x, 32 - h + y - 6, 1, 1); } }
  const m = new THREE.MeshBasicMaterial({ map: pixelTexture(cv), transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const g = new THREE.Group();
  for (let k = 0; k < 3; k++) { const mesh = new THREE.Mesh(new THREE.PlaneGeometry(420, 130), m); mesh.position.set(-120 + k * 140, 150, -300 + k * 30); mesh.rotation.y = -0.2 + k * 0.2; mesh.renderOrder = -8; g.add(mesh); }
  return g;
}

// ---------------------------------------------------------------- the scenery
interface S { b: Builder; r: Rng; l: Look; dim: string; night: number }
const col = (s: S, hex: string) => C(multiply(hex, s.dim));
function multiply(a: string, b: string) {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const r = Math.round((((x >> 16) & 255) * ((y >> 16) & 255)) / 255), g = Math.round((((x >> 8) & 255) * ((y >> 8) & 255)) / 255), bb = Math.round(((x & 255) * (y & 255)) / 255);
  return `#${((r << 16) | (g << 8) | bb).toString(16).padStart(6, "0")}`;
}
/** a block placed by polar position around the arena */
function polar(s: S, a: number, d: number, y: number, sx: number, sy: number, sz: number, hex: string, lit = false) {
  s.b.box(Math.cos(a) * d, y + sy / 2, Math.sin(a) * d, sx, sy, sz, lit ? C(hex) : col(s, hex));
}
/** a stepped mound (hill, mesa, peak) at an angle and distance */
function mound(s: S, a: number, d: number, w: number, h: number, steps: number, hex: string, capHex?: string, capFrom = 1) {
  for (let k = 0; k < steps; k++) {
    const t = k / steps, ww = w * (1 - t * 0.8), hh = h / steps;
    const c = capHex && t >= capFrom ? capHex : shade(hex, (k % 2 ? -0.04 : 0.02) + t * 0.08);
    polar(s, a, d, k * hh - 2, ww, hh + 0.01, ww * 0.9, c);
  }
}
function towerWindows(s: S, x: number, z: number, w: number, h: number, base: string, lit: string, face: number) {
  const b = s.b;
  b.box(x, h / 2 - 2, z, w, h, w, col(s, base));
  // window rows facing the arena
  const nx = -Math.cos(face), nz = -Math.sin(face);
  for (let y = 2; y < h - 3; y += 3.2) for (let k = -1; k <= 1; k++) {
    if (s.r() < 0.35) continue;
    const ox = -nz * k * w * 0.28, oz = nx * k * w * 0.28;
    b.box(x + nx * (w / 2 + 0.05) + ox, y - 2, z + nz * (w / 2 + 0.05) + oz, Math.abs(nz) > 0.5 ? w * 0.2 : 0.1, 1.4, Math.abs(nx) > 0.5 ? w * 0.2 : 0.1, C(s.night > 0.3 ? lit : multiply(shade(base, -0.25), s.dim)));
  }
}

function scenery(l: Look, seed: number) {
  const s: S = { b: new Builder(), r: makeRng(seed), l, dim: l.dim, night: l.night };
  const kinds = [l.world.backdrop, ...(l.partner ? [l.partner.backdrop] : [])];
  const R = s.r;
  const ring = (n: number, d0: number, d1: number, fn: (a: number, d: number) => void) => { for (let k = 0; k < n; k++) fn((k / n) * Math.PI * 2 + R() * 0.3, range(R, d0, d1)); };
  for (const kind of kinds) {
    const w = kind === l.world.backdrop ? l.world : l.partner!;
    const pal = w.palette;
    switch (kind) {
      case "town":
        ring(18, 120, 190, (a, d) => mound(s, a, d, range(R, 40, 70), range(R, 12, 26), 5, mix(pal.top, "#3E8A3A", 0.3)));
        ring(26, 60, 95, (a, d) => mound(s, a, d, range(R, 14, 26), range(R, 4, 9), 3, pal.top));
        ring(20, 55, 100, (a, d) => { const h = range(R, 4, 8); polar(s, a, d, 0, 1, h * 0.5, 1, "#6A4426"); polar(s, a, d, h * 0.5, 4, h * 0.6, 4, shade("#3E9A3A", range(R, -0.1, 0.1))); });
        ring(4, 70, 110, (a, d) => { polar(s, a, d, 0, 8, 6, 6, "#C8402A"); polar(s, a, d, 6, 9, 2.4, 7, "#8A2A20"); polar(s, a + 0.06, d, 0, 3, 11, 3, "#D8D0C0"); polar(s, a + 0.06, d, 11, 3.4, 1.4, 3.4, "#8A2A20"); });
        ring(3, 80, 120, (a, d) => { for (let k = 0; k < 6; k++) polar(s, a, d, k * 2, 5 - k * 0.4, 2, 5 - k * 0.4, "#E8E0D0"); polar(s, a, d, 12, 4, 2.5, 4, "#C8402A"); const x = Math.cos(a) * (d - 2.6), z = Math.sin(a) * (d - 2.6); for (const [sx, sy] of [[9, 1.2], [1.2, 9]]) s.b.box(x, 11, z, Math.abs(Math.sin(a)) * sx + 0.6, sy, Math.abs(Math.cos(a)) * sx + 0.6, col(s, "#F2EAD8")); });
        // red-brick and painted houses with pitched roofs, a water tower and a church spire
        ring(34, 52, 95, (a, d) => {
          const w = range(R, 5, 8), h = range(R, 4, 7), c = pick(R, ["#B8503A", "#F2EAD8", "#E8C870", "#9AC8E8", "#C87A5A"]);
          polar(s, a, d, 0, w, h, w * 0.8, c);
          for (let k = 0; k < 3; k++) polar(s, a, d, h + k * 1.1, w * (1 - k * 0.3) + 0.4, 1.1, w * 0.8 * (1 - k * 0.3) + 0.4, pick(R, ["#3A4A6A", "#8A2A20", "#4A3A3A"]));
          polar(s, a, d, h * 0.4, w + 0.1, 1.2, w * 0.25, "#FFE8A0", true);
        });
        ring(1, 78, 86, (a, d) => { for (const o of [-1.6, 1.6]) polar(s, a + o * 0.02, d, 0, 0.6, 14, 0.6, "#8A92A6"); polar(s, a, d, 14, 7, 5, 7, "#C8D8E8"); polar(s, a, d, 19, 5, 1.5, 5, "#8A92A6"); });
        ring(1, 100, 110, (a, d) => { polar(s, a, d, 0, 7, 10, 10, "#E8E0D0"); polar(s, a, d, 10, 7.6, 2, 10.6, "#5A3A3A"); polar(s, a, d, 0, 3, 18, 3, "#E8E0D0"); for (let k = 0; k < 4; k++) polar(s, a, d, 18 + k * 1.6, 2.6 - k * 0.6, 1.6, 2.6 - k * 0.6, "#5A3A3A"); polar(s, a, d, 25, 0.3, 2, 0.3, "#E8B030"); });
        break;
      case "desert":
        ring(14, 110, 200, (a, d) => { const h = range(R, 18, 42), wd = range(R, 26, 50); for (let k = 0; k < 6; k++) polar(s, a, d, (k * h) / 6 - 2, wd * (1 - k * 0.03), h / 6 + 0.01, wd * 0.8, k % 2 ? shade(pal.side, 0.08) : pal.side); polar(s, a, d, h - 2, wd * 0.82, 1.2, wd * 0.66, pal.top); });
        ring(10, 60, 100, (a, d) => mound(s, a, d, range(R, 10, 18), range(R, 6, 12), 4, pal.wall));
        ring(2, 80, 110, (a, d) => { polar(s, a, d, 0, 4, 18, 4, pal.side); polar(s, a + 0.12, d, 0, 4, 18, 4, pal.side); const x = Math.cos(a + 0.06) * d, z = Math.sin(a + 0.06) * d; s.b.box(x, 17, z, 14, 4, 5, col(s, pal.side)); });
        ring(30, 55, 90, (a, d) => { polar(s, a, d, 0, 0.8, 3, 0.8, "#4A9A4A"); polar(s, a, d, 1.6, 1.8, 0.6, 0.6, "#4A9A4A"); });
        break;
      case "harbor":
        ring(16, 120, 210, (a, d) => mound(s, a, d, range(R, 40, 64), range(R, 40, 80), 8, "#6A7A98", "#F4FAFF", 0.55));
        ring(22, 70, 110, (a, d) => mound(s, a, d, range(R, 14, 24), range(R, 8, 18), 4, "#8AA0C0", "#F4FAFF", 0.5));
        ring(40, 50, 90, (a, d) => { const h = range(R, 6, 11); for (let k = 0; k < 4; k++) polar(s, a, d, k * h * 0.22, (4 - k) * 1.1, h * 0.25, (4 - k) * 1.1, k === 3 ? "#F4FAFF" : "#2E5A4A"); });
        ring(1, 85, 95, (a, d) => { polar(s, a, d, 0, 10, 6, 10, "#D8DCE8"); polar(s, a, d, 6, 7, 3, 7, "#F2F2F2"); polar(s, a, d, 9, 0.6, 9, 0.6, "#8A92A6"); polar(s, a, d, 18, 1.2, 1.2, 1.2, "#FF4A4A", true); });
        // the harbour: cranes, stacked containers and ships at the quay
        ring(5, 70, 110, (a, d) => { const h = range(R, 16, 24); polar(s, a, d, 0, 1.2, h, 1.2, "#E8B030"); const x = Math.cos(a) * d, z = Math.sin(a) * d; s.b.box(x + Math.cos(a) * 4, h, z + Math.sin(a) * 4, Math.abs(Math.cos(a)) * 12 + 1, 1, Math.abs(Math.sin(a)) * 12 + 1, col(s, "#E8B030")); polar(s, a, d, h - 2, 2.4, 2, 2.4, "#C83A3A"); });
        ring(14, 60, 95, (a, d) => { for (let k = 0; k < 3; k++) polar(s, a, d, k * 2.5, 6, 2.5, 2.4, pick(R, ["#C83A3A", "#2A6AA8", "#E8B030", "#3E9A5A"])); });
        ring(4, 110, 150, (a, d) => { polar(s, a, d, -0.4, 22, 4, 7, "#2A3A5A"); polar(s, a, d, 3.6, 8, 5, 6, "#F2F2F2"); polar(s, a, d, 8.6, 1.4, 4, 1.4, "#C83A3A"); });
        break;
      case "skyline":
        for (let k = 0; k < 70; k++) {
          const a = (k / 70) * Math.PI * 2 + R() * 0.05, d = range(R, 70, 200), wd = range(R, 7, 16), h = range(R, 20, 85);
          const base = pick(R, ["#2A2E4A", "#3A3060", "#22304A", "#40305A"]);
          towerWindows(s, Math.cos(a) * d, Math.sin(a) * d, wd, h, base, pick(R, ["#FFD88A", "#9AE8FF", "#FFE0A0"]), a);
          if (chance(R, 0.35)) s.b.box(Math.cos(a) * (d - wd / 2 - 0.3), h * range(R, 0.4, 0.8), Math.sin(a) * (d - wd / 2 - 0.3), Math.abs(Math.sin(a)) * wd * 0.7 + 0.3, 2.5, Math.abs(Math.cos(a)) * wd * 0.7 + 0.3, C(pick(R, ["#FF4FD8", "#5BF0FF", "#FFD23F", "#7CFF8A"])));
          if (chance(R, 0.5)) s.b.box(Math.cos(a) * d, h - 2 + 3, Math.sin(a) * d, 0.5, 6, 0.5, col(s, "#5A5E6E"));
          if (chance(R, 0.5)) s.b.box(Math.cos(a) * d, h - 2 + 6.4, Math.sin(a) * d, 0.9, 0.9, 0.9, C("#FF3A3A"));
        }
        break;
      case "temples":
        ring(20, 110, 190, (a, d) => mound(s, a, d, range(R, 36, 60), range(R, 14, 30), 5, "#2E7A3A"));
        ring(3, 70, 110, (a, d) => { for (let k = 0; k < 6; k++) polar(s, a, d, k * 3, 22 - k * 3.2, 3.01, 22 - k * 3.2, k % 2 ? "#8A9A7A" : "#7A8A6A"); polar(s, a, d, 18, 4, 4, 4, "#5A6A4A"); });
        ring(3, 80, 120, (a, d) => { polar(s, a, d, 0, 14, 30, 10, "#4A6A4A"); const x = Math.cos(a) * (d - 5.2), z = Math.sin(a) * (d - 5.2); s.b.box(x, 13, z, Math.abs(Math.sin(a)) * 4 + 0.4, 28, Math.abs(Math.cos(a)) * 4 + 0.4, C(multiply("#E8F8FF", s.dim))); });
        ring(50, 50, 95, (a, d) => { const h = range(R, 6, 14); polar(s, a, d, 0, 1, h, 1, "#6A4426"); polar(s, a, d, h, range(R, 4, 7), 3, range(R, 4, 7), shade("#2E8A3A", range(R, -0.12, 0.1))); });
        break;
      case "volcano": {
        const a0 = R() * Math.PI * 2;
        for (let k = 0; k < 10; k++) { const t = k / 10; polar(s, a0, 190, t * 70 - 2, 140 * (1 - t * 0.85), 7.01, 120 * (1 - t * 0.85), k % 2 ? "#4A3A40" : "#3A2E34"); }
        for (let k = 0; k < 5; k++) { const a = a0 + (k - 2) * 0.04; s.b.box(Math.cos(a) * 150, 30 - k * 3, Math.sin(a) * 150, 3, 50, 3, C("#FF6A2A")); }
        s.b.box(Math.cos(a0) * 190, 72, Math.sin(a0) * 190, 22, 3, 22, C("#FFB03A"));
        ring(16, 100, 170, (a, d) => mound(s, a, d, range(R, 30, 50), range(R, 10, 22), 4, "#3A2E30"));
        ring(8, 60, 100, (a, d) => { const h = range(R, 14, 30); polar(s, a, d, 0, 4, h, 4, "#5A4A48"); polar(s, a, d, h, 4.6, 1.5, 4.6, "#FF6A2A", true); polar(s, a + 0.08, d, 0, 12, 8, 10, "#4A3A3A"); });
        break;
      }
      case "coast":
        ring(7, 120, 210, (a, d) => { mound(s, a, d, range(R, 30, 60), range(R, 6, 16), 4, "#3E9A4A"); polar(s, a, d, -1.5, range(R, 30, 60) * 1.1, 1, 30, "#F0D890"); });
        ring(1, 80, 90, (a, d) => { for (let k = 0; k < 8; k++) polar(s, a, d, k * 2, 3.6 - k * 0.15, 2, 3.6 - k * 0.15, k % 2 ? "#E8E0D0" : "#D8302A"); polar(s, a, d, 16, 2.6, 2, 2.6, "#FFF6C0", true); polar(s, a, d, 18, 3.2, 1.2, 3.2, "#2A2D3E"); });
        ring(1, 60, 70, (a, d) => { for (let k = 0; k < 10; k++) polar(s, a, d + k * 3, -0.6, 3, 0.4, 3, "#A8703E"); });
        ring(8, 90, 160, (a, d) => { polar(s, a, d, -0.5, 6, 1, 3, "#F2F2F2"); polar(s, a, d, 0.5, 0.3, 6, 0.3, "#8A6A44"); polar(s, a + 0.01, d, 2, 3, 4, 0.2, "#F8F8F8"); });
        break;
      case "islands":
        ring(14, 80, 190, (a, d) => {
          const y = range(R, -20, 30), w = range(R, 14, 34);
          for (let k = 0; k < 5; k++) polar(s, a, d, y - k * w * 0.18, w * (1 - k * 0.2), w * 0.18 + 0.01, w * (1 - k * 0.2) * 0.9, k === 0 ? "#7CD86A" : "#A88A68");
          if (chance(R, 0.6)) { polar(s, a, d, y + w * 0.18, 1.2, 4, 1.2, "#6A4426"); polar(s, a, d, y + w * 0.18 + 4, 5, 3, 5, "#4EA84A"); }
          if (chance(R, 0.4)) { const x = Math.cos(a) * (d - w * 0.4), z = Math.sin(a) * (d - w * 0.4); s.b.box(x, y - 14, z, 1.5, 26, 1.5, C(multiply("#E8F8FF", s.dim))); }
        });
        ring(3, 70, 140, (a, d) => { const y = range(R, 20, 40); polar(s, a, d, y, 18, 6, 6, "#D8C8A8"); polar(s, a, d, y - 3, 6, 3, 4, "#8A5A3A"); polar(s, a, d, y + 1, 19, 1, 2, "#C8402A"); });
        break;
      case "pagodas": {
        // misty blue mountains far off, blossom hills, pagodas, red gates and bamboo
        ring(16, 130, 210, (a, d) => mound(s, a, d, range(R, 44, 70), range(R, 30, 60), 7, "#8A98C0", "#F2F0F8", 0.7));
        ring(22, 70, 120, (a, d) => mound(s, a, d, range(R, 16, 28), range(R, 5, 10), 3, mix(pal.top, "#6AA84A", 0.3)));
        ring(46, 48, 100, (a, d) => {
          const h = range(R, 4, 7), w = range(R, 4, 7), pink = pick(R, ["#F6A8CC", "#FFC0DA", "#F090BC", "#FFD6E6"]);
          polar(s, a, d, 0, 0.9, h * 0.6, 0.9, "#5A3A2A");
          polar(s, a, d, h * 0.55, w, h * 0.45, w * 0.9, pink);
          polar(s, a, d, h * 0.95, w * 0.6, h * 0.25, w * 0.55, shade(pink, 0.12));
        });
        ring(4, 75, 115, (a, d) => {
          // a five-tier pagoda: plaster walls under flared dark roofs, a gold spire
          for (let k = 0; k < 5; k++) {
            const w = 9 - k * 1.4, y = k * 3.4;
            polar(s, a, d, y, w * 0.7, 2.4, w * 0.7, k % 2 ? "#F2E8D8" : "#E8DCC8");
            polar(s, a, d, y + 2.4, w + 1.6, 0.6, w + 1.6, "#3A2A3A");
            polar(s, a, d, y + 2.2, w + 2.2, 0.3, w + 2.2, "#C83A3A");
          }
          polar(s, a, d, 17, 0.5, 4, 0.5, "#E8B030");
        });
        ring(3, 58, 80, (a, d) => {
          // a red gate
          const x = Math.cos(a) * d, z = Math.sin(a) * d, tx = -Math.sin(a), tz = Math.cos(a);
          for (const o of [-3, 3]) s.b.box(x + tx * o, 3.5, z + tz * o, 0.8, 7, 0.8, col(s, "#D8302A"));
          s.b.box(x, 7.2, z, Math.abs(tx) * 9 + 1, 0.9, Math.abs(tz) * 9 + 1, col(s, "#2A1A22"));
          s.b.box(x, 6, z, Math.abs(tx) * 7.5 + 0.6, 0.5, Math.abs(tz) * 7.5 + 0.6, col(s, "#D8302A"));
        });
        ring(26, 52, 90, (a, d) => { for (let k = 0; k < 4; k++) polar(s, a + k * 0.006, d + (k % 2) * 1.2, 0, 0.35, range(R, 7, 12), 0.35, k % 2 ? "#6AB04A" : "#4E9A3A"); });
        break;
      }
      case "crystals": {
        // dark violet ridges, then giant glowing crystal spires, clusters and shards hanging in the sky
        ring(16, 120, 200, (a, d) => mound(s, a, d, range(R, 40, 66), range(R, 14, 30), 5, "#3A2E58"));
        ring(14, 70, 150, (a, d) => {
          const h = range(R, 24, 70), w = range(R, 4, 8), c = pick(R, ["#8A3AD8", "#2A9AD8", "#C83AA0", "#6A4AE0"]);
          for (let k = 0; k < 6; k++) polar(s, a + k * 0.004, d, (k * h) / 6 - 2, w * (1 - k * 0.14), h / 6 + 0.01, w * (1 - k * 0.14), shade(c, k * 0.06 - 0.1), true);
          polar(s, a, d, h - 2, w * 0.2, 3, w * 0.2, "#E8C8FF", true);
        });
        ring(30, 48, 95, (a, d) => {
          const c = pick(R, ["#9A4AE0", "#3AA8D8", "#D84AA8"]);
          for (let k = 0; k < 3; k++) { const h = range(R, 3, 9); polar(s, a + (k - 1) * 0.02, d + k, 0, 1.2 - k * 0.2, h, 1.2 - k * 0.2, shade(c, -0.05 * k), true); }
          polar(s, a, d, -0.5, 6, 1, 5, "#4A3A68");
        });
        ring(18, 70, 180, (a, d) => polar(s, a, d, range(R, 30, 70), range(R, 1.5, 4), range(R, 3, 7), range(R, 1.5, 4), pick(R, ["#B86AF0", "#5AC8F0", "#F06AC0"]), true));
        break;
      }
      case "craters":
        ring(14, 120, 200, (a, d) => mound(s, a, d, range(R, 40, 70), range(R, 10, 24), 5, "#6A6A78"));
        ring(14, 60, 110, (a, d) => { const w = range(R, 10, 20); for (let k = 0; k < 4; k++) polar(s, a + (k - 1.5) * 0.04, d, 0, w * 0.3, 2 + (k % 3), w * 0.3, "#8A8A98"); });
        ring(4, 70, 100, (a, d) => { polar(s, a, d, 0, 10, 4, 10, "#9AF0FF", true); polar(s, a, d, 4, 6, 2.5, 6, "#C8F8FF", true); polar(s, a, d, -0.5, 11, 0.6, 11, "#8A90A0"); });
        ring(1, 90, 100, (a, d) => { polar(s, a, d, 0, 5, 40, 5, "#8A90A0"); polar(s, a + 0.05, d, 2, 4, 26, 4, "#F2F2F2"); polar(s, a + 0.05, d, 28, 4, 3, 4, "#D8302A"); });
        break;
      case "megatower":
        for (let k = 0; k < 24; k++) {
          const a = (k / 24) * Math.PI * 2 + R() * 0.1, d = range(R, 80, 190), wd = range(R, 8, 18), h = range(R, 30, 110);
          polar(s, a, d, 0, wd, h, wd, pick(R, ["#5A606E", "#7A808E", "#4A4E5A"]));
          polar(s, a, d, h, wd * 0.6, h * 0.12, wd * 0.6, "#3A3E4A");
          polar(s, a, d, h * 0.6, wd + 0.2, 1.2, wd + 0.2, "#FF2A3A", true);
          polar(s, a, d, h + h * 0.12, 1.4, 1.4, 1.4, "#FF4A5A", true);
        }
        ring(12, 60, 100, (a, d) => polar(s, a, d, 0, range(R, 10, 20), range(R, 6, 14), 6, "#3A3E4A"));
        // Baron Bolt's own tower: a giant chrome spire with a red crown
        ring(1, 150, 160, (a, d) => { for (let k = 0; k < 8; k++) polar(s, a, d, k * 18, 30 - k * 3, 18.01, 30 - k * 3, k % 2 ? "#6A707E" : "#8A90A0"); polar(s, a, d, 144, 4, 20, 4, "#FF2A3A", true); polar(s, a, d, 100, 31, 2, 31, "#FF4A5A", true); });
        break;
    }
  }
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
  return new THREE.Mesh(s.b.geometry(), m);
}

/** voxel clouds drifting high up */
function clouds(l: Look, seed: number) {
  const r = makeRng(seed + 5), b = new Builder();
  const base = l.night > 0.5 ? "#4A5A80" : l.world.id === "lava" ? "#6A5A5A" : "#FFFFFF";
  for (let k = 0; k < 22; k++) {
    const a = r() * Math.PI * 2, d = range(r, 90, 260), y = range(r, 60, 110), w = range(r, 16, 40);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    b.box(x, y, z, w, 4, w * 0.6, C(base));
    b.box(x + w * 0.15, y + 3, z, w * 0.6, 3, w * 0.4, C(shade(base, 0.05)));
    if (chance(r, 0.5)) b.box(x - w * 0.35, y + 1, z + 2, w * 0.4, 3, w * 0.3, C(base));
  }
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: l.world.id === "moon" ? 0 : 0.92, fog: false, depthWrite: false });
  return new THREE.Mesh(b.geometry(), m);
}

/** the land beyond the arena walls */
function beyond(l: Look) {
  const w = l.world;
  let colr = multiply(shade(w.palette.top, -0.1), l.dim), y = -0.6;
  if (w.backdrop === "coast" || w.backdrop === "harbor") { colr = multiply(w.backdrop === "harbor" ? "#5A8AB8" : "#2AB8D8", l.dim); y = -0.4; }
  if (w.id === "cloud") { colr = multiply("#E8F2FF", l.dim); y = -30; }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshBasicMaterial({ color: colr, fog: true }));
  m.rotation.x = -Math.PI / 2; m.position.y = y;
  return m;
}

export interface Backdrop { group: THREE.Group; clouds: THREE.Mesh; weather: WeatherFx | null; dispose: () => void }

export function buildBackdrop(l: Look, plan: LookIn, q: "low" | "medium" | "high"): Backdrop {
  const group = new THREE.Group();
  group.add(skyDome(l));
  const moon = l.night > 0.6;
  group.add(sunSprite(l, moon));
  if (l.night > 0.4) group.add(stars(makeRng(plan.seed + 9), q === "low" ? 200 : 450));
  if (l.world.id === "moon" || l.partner?.id === "moon") group.add(earth());
  if ((l.world.id === "frost" || l.partner?.id === "frost") && l.night > 0.5) group.add(aurora());
  group.add(beyond(l));
  group.add(scenery(l, plan.seed + 3));
  const cl = clouds(l, plan.seed);
  group.add(cl);
  const weather = plan.weather === "clear" || plan.weather === "stars" ? null : new WeatherFx(plan.weather, q === "low" ? 350 : q === "medium" ? 650 : 1000);
  if (weather) group.add(weather.points);
  return {
    group, clouds: cl, weather,
    dispose: () => group.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((x) => { (x as THREE.MeshBasicMaterial).map?.dispose(); x.dispose(); }); }),
  };
}

// ---------------------------------------------------------------- weather
const WX: Record<Exclude<Weather, "clear" | "stars">, { col: string; fall: number; drift: number; size: number; sway: number }> = {
  rain: { col: "#A8C8F0", fall: 26, drift: 2, size: 2.5, sway: 0 },
  snow: { col: "#FFFFFF", fall: 2.4, drift: 1, size: 3.5, sway: 1 },
  dust: { col: "#E8C890", fall: 0.4, drift: 7, size: 3, sway: 0.5 },
  embers: { col: "#FF8A3A", fall: -2, drift: 1.2, size: 3, sway: 1.2 },
  leaves: { col: "#E8A03A", fall: 1.6, drift: 1.5, size: 4, sway: 1.6 },
  fireflies: { col: "#E8FF7A", fall: 0, drift: 0.5, size: 3.5, sway: 1 },
  spores: { col: "#9AF0C8", fall: -0.5, drift: 0.6, size: 3, sway: 1 },
  petals: { col: "#FFB8D8", fall: 1.4, drift: 1.4, size: 3.5, sway: 1.4 },
};
export class WeatherFx {
  points: THREE.Points;
  private pos: Float32Array;
  private phase: Float32Array;
  private spec: (typeof WX)[keyof typeof WX];
  constructor(kind: Weather, n: number) {
    this.spec = WX[kind as keyof typeof WX];
    this.pos = new Float32Array(n * 3); this.phase = new Float32Array(n);
    for (let i = 0; i < n; i++) { this.pos[i * 3] = (Math.random() - 0.5) * 60; this.pos[i * 3 + 1] = Math.random() * 30; this.pos[i * 3 + 2] = (Math.random() - 0.5) * 60; this.phase[i] = Math.random() * 6.28; }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    const m = new THREE.PointsMaterial({ color: this.spec.col, size: this.spec.size, sizeAttenuation: false, transparent: true, opacity: kind === "rain" ? 0.6 : 0.85, depthWrite: false, fog: false });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
  }
  update(dt: number, t: number, cx: number, cy: number, cz: number) {
    const p = this.pos, s = this.spec, n = this.phase.length;
    for (let i = 0; i < n; i++) {
      const k = i * 3;
      p[k] += (s.drift + Math.sin(t * 1.3 + this.phase[i]) * s.sway) * dt;
      p[k + 1] -= s.fall * dt;
      p[k + 2] += Math.cos(t * 1.1 + this.phase[i]) * s.sway * dt;
      // keep every flake in a 60 m box around the camera
      if (p[k] - cx > 30) p[k] -= 60; else if (p[k] - cx < -30) p[k] += 60;
      if (p[k + 2] - cz > 30) p[k + 2] -= 60; else if (p[k + 2] - cz < -30) p[k + 2] += 60;
      if (p[k + 1] - cy < -8) p[k + 1] += 30; else if (p[k + 1] - cy > 22) p[k + 1] -= 30;
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}
