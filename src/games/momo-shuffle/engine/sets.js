// Clay sets: the "Track Momo" game-show stage, a seamless studio for character
// sheets, lighting rigs, and confetti.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clay, glow, mesh, sphere, limb, lumpy, text3d, clayStar, rng, V } from './clay.js';
import { PAL } from './characters.js';

export function addLights(scene, { key = [7, 13, 11], keyI = 2.6, fill = 0.7, rim = 1.4, hemi = 0.9, shadowBox = 14, mapSize = 4096 } = {}) {
  scene.add(new THREE.HemisphereLight('#FFF1DE', '#6B4A3A', hemi));
  const k = new THREE.DirectionalLight('#FFE1BE', keyI);
  k.position.set(...key);
  k.castShadow = mapSize > 0;
  k.shadow.mapSize.set(Math.max(256, mapSize), Math.max(256, mapSize));
  Object.assign(k.shadow.camera, { left: -shadowBox, right: shadowBox, top: shadowBox, bottom: -shadowBox, near: 1, far: 60 });
  k.shadow.bias = -0.0004; k.shadow.normalBias = 0.03; k.shadow.radius = 5;
  scene.add(k);
  const f = new THREE.DirectionalLight('#BFD6FF', fill); f.position.set(-10, 6, 7); scene.add(f);
  const r = new THREE.DirectionalLight('#FFD3EC', rim); r.position.set(-4, 9, -12); scene.add(r);
  return k;
}

// Seamless curved backdrop (floor sweeping up into a wall).
export function makeStudio({ color = '#F4C7A1', width = 70, zFront = 28, zCurve = -4, radius = 6, wallH = 26 } = {}) {
  const g = new THREE.Group();
  const floorLen = zFront - zCurve;
  const total = floorLen + (Math.PI / 2) * radius + wallH;
  const geo = new THREE.PlaneGeometry(width, total, 140, 220);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i); const s = p.getY(i) + total / 2; // 0..total from front edge
    let y, z;
    if (s < floorLen) { y = 0; z = zFront - s; }
    else if (s < floorLen + (Math.PI / 2) * radius) {
      const a = (s - floorLen) / radius;
      y = radius - Math.cos(a) * radius; z = zCurve - Math.sin(a) * radius;
    } else { y = radius + (s - floorLen - (Math.PI / 2) * radius); z = zCurve - radius; }
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  // normals must face the camera (+z / +y)
  const n = geo.attributes.normal; const flip = n.getZ(0) < 0; // vertex 0 sits on the wall
  if (flip) { geo.index.array.reverse(); geo.computeVertexNormals(); }
  lumpy(geo, { amp: 0.06, freq: 0.5, mode: 'normal' });
  const m = mesh(geo, clay(color, { bump: 1.4, freq: 0.6, variation: 0.08 }));
  m.castShadow = false;
  g.add(m);
  return g;
}

export function makePedestal(color, r = 1.7) {
  const g = new THREE.Group();
  g.add(mesh(lumpy(new THREE.CylinderGeometry(r, r * 1.04, 0.36, 72, 2), { amp: 0.03, freq: 1.2 }), clay(color, { bump: 1.6 }), { p: [0, 0.18, 0] }));
  const n = Math.round(r * 16);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    g.add(mesh(sphere(0.12), clay('#FFF4E2'), { p: [Math.cos(a) * (r + 0.02), 0.06, Math.sin(a) * (r + 0.02)], s: [1, 0.8, 1] }));
  }
  return g;
}

function cloud(scale = 1) {
  const g = new THREE.Group();
  const m = clay('#FFF8EE', { bump: 1.4 });
  for (const [x, y, r] of [[0, 0, 1], [1.1, -0.2, 0.75], [-1.1, -0.25, 0.7], [0.5, 0.45, 0.7], [-0.5, 0.35, 0.6]])
    g.add(mesh(sphere(r), m, { p: [x, y, 0], s: [1, 0.85, 0.45] }));
  g.scale.setScalar(scale);
  return g;
}

function cactus() {
  const g = new THREE.Group();
  g.add(mesh(lumpy(new THREE.CylinderGeometry(0.75, 0.58, 1.1, 48, 3), { amp: 0.02 }), clay('#C8643B', { bump: 1.6 }), { p: [0, 0.55, 0] }));
  g.add(mesh(lumpy(new THREE.TorusGeometry(0.76, 0.1, 12, 48), { amp: 0.01 }), clay('#B4532E'), { p: [0, 1.1, 0], r: [Math.PI / 2, 0, 0] }));
  g.add(mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.05, 32), clay('#5B3A25'), { p: [0, 1.08, 0] }));
  const green = clay('#4FA35B', { bump: 2 });
  g.add(limb(V(0, 1.2, 0), V(0, 2.5, 0), 0.4, green));
  g.add(limb(V(0.3, 1.9, 0), V(0.75, 2.0, 0), 0.17, green));
  g.add(limb(V(0.75, 2.0, 0), V(0.8, 2.55, 0), 0.17, green));
  g.add(mesh(sphere(0.16), clay('#FF7AB6'), { p: [0, 2.95, 0], s: [1, 0.7, 1] }));
  for (let i = 0; i < 14; i++) {
    const a = i * 2.4, y = 1.5 + (i % 7) * 0.17;
    g.add(mesh(sphere(0.035), clay('#FFF4E2'), { p: [Math.cos(a) * 0.41, y, Math.sin(a) * 0.41] }));
  }
  return g;
}

function lamp(side) {
  const g = new THREE.Group();
  const dark = clay('#3B2F45', { bump: 1.2 });
  g.add(limb(V(0, 0.05, 0), V(0, 4.0, 0), 0.1, dark));
  g.add(mesh(lumpy(new THREE.CylinderGeometry(0.7, 0.75, 0.15, 32), { amp: 0.01 }), dark, { p: [0, 0.07, 0] }));
  const head = new THREE.Group();
  head.add(mesh(lumpy(new THREE.CylinderGeometry(0.42, 0.75, 1.0, 40, 3), { amp: 0.015 }), clay('#FFC93C', { bump: 1.4 })));
  head.add(mesh(new THREE.CircleGeometry(0.68, 32), glow('#FFF3C4', 2.5), { p: [0, -0.51, 0], r: [Math.PI / 2, 0, 0] }));
  head.position.set(0, 4.3, 0);
  head.rotation.set(-0.9, 0, side * 0.6);
  g.add(head);
  return g;
}

// The main game-show stage. Origin = stage floor centre.
export function makeStage({ board = 'TRACK MOMO', seed = 7 } = {}) {
  const g = new THREE.Group();
  const R = rng(seed);
  // room floor
  const floor = new THREE.PlaneGeometry(90, 70, 1, 1); floor.rotateX(-Math.PI / 2);
  g.add(mesh(floor, clay('#8A5A3B', { bump: 2.2, freq: 0.7 }), { p: [0, -0.5, 0] }));
  // stage disc
  g.add(mesh(lumpy(new THREE.CylinderGeometry(9, 9.2, 0.5, 120, 2), { amp: 0.05, freq: 0.6 }), clay('#F2B544', { bump: 1.8, freq: 0.5 }), { p: [0, -0.25, 0] }));
  g.add(mesh(lumpy(new THREE.TorusGeometry(7.4, 0.09, 12, 160), { amp: 0.01 }), clay('#FFF1DA'), { p: [0, 0.0, 0], r: [Math.PI / 2, 0, 0] }));
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    g.add(mesh(sphere(0.33), clay(i % 2 ? '#FFF1DA' : '#F27BA0'), { p: [Math.cos(a) * 9.15, -0.13, Math.sin(a) * 9.15], s: [1, 0.8, 1] }));
  }
  // back wall
  const wall = new THREE.PlaneGeometry(80, 36, 160, 72);
  lumpy(wall, { amp: 0.12, freq: 0.35, mode: 'normal' });
  const w = mesh(wall, clay('#4C6FB0', { bump: 2, freq: 0.5 }), { p: [0, 12, -14] }); w.castShadow = false; g.add(w);
  // wall decor: stars + clouds
  const starCols = ['#FFD25A', '#FFF1DA', '#FF9AC1'];
  for (let i = 0; i < 26; i++) {
    const x = (R() - 0.5) * 50, y = 2 + R() * 22;
    if (Math.abs(x) < 8 && y < 10) continue;
    const s = clayStar(0.35 + R() * 0.55, starCols[i % 3]);
    s.position.set(x, y, -13.6); s.rotation.z = R() * 1.2; g.add(s);
  }
  for (const [x, y, s] of [[-15, 13, 1.4], [13, 15, 1.2], [-6, 18, 1], [18, 6, 1.1], [-19, 5, 1]]) {
    const c = cloud(s); c.position.set(x, y, -13.4); g.add(c);
  }
  // arch portal
  const disc = mesh(new THREE.CircleGeometry(6.2, 96, 0, Math.PI), clay('#3A2A63', { bump: 1.5, freq: 0.6 }), { p: [0, 0, -6.95] });
  disc.castShadow = false; g.add(disc);
  for (let i = 0; i < 14; i++) {
    const a = R() * Math.PI, rr = 1.2 + R() * 4.6;
    const s = clayStar(0.12 + R() * 0.16, i % 2 ? '#FFD25A' : '#FFF1DA');
    s.position.set(Math.cos(a) * rr, Math.sin(a) * rr, -6.85); g.add(s);
  }
  g.add(mesh(lumpy(new THREE.TorusGeometry(6.6, 0.5, 28, 120, Math.PI), { amp: 0.04 }), clay('#F27BA0', { bump: 1.8 }), { p: [0, 0, -6.6] }));
  g.add(mesh(lumpy(new THREE.TorusGeometry(5.95, 0.16, 16, 120, Math.PI), { amp: 0.01 }), clay('#FFD25A'), { p: [0, 0, -6.55] }));
  const bulb = glow('#FFE9A8', 2.2);
  for (let i = 0; i <= 18; i++) {
    const a = (i / 18) * Math.PI;
    g.add(mesh(new THREE.SphereGeometry(0.17, 20, 14), bulb, { p: [Math.cos(a) * 6.6, Math.sin(a) * 6.6, -6.08] }));
  }
  // scoreboard (omitted when the shot's overlay text takes its place)
  if (board) addScoreboard(g, board, bulb);
  // curtains
  addCurtains(g);
  // side props
  for (const s of [-1, 1]) {
    const l = lamp(s); l.position.set(s * 8.3, 0, -3.8); g.add(l);
    const c = cactus(); c.position.set(s * 7.4, 0, 2.6); c.rotation.y = s * 0.6; g.add(c);
  }
  return g;
}

function addScoreboard(g, board, bulb) {
  const sb = new THREE.Group();
  sb.add(mesh(new RoundedBoxGeometry(8.4, 2.0, 0.5, 6, 0.22), clay(PAL.navy, { bump: 1.8, freq: 0.6 })));
  const t = text3d(board, { size: 0.95, depth: 0.2, color: '#FFD25A', bevel: 0.05 }); t.position.z = 0.35; sb.add(t);
  for (let i = 0; i < 22; i++) {
    const x = -4.0 + (i / 21) * 8.0;
    sb.add(mesh(new THREE.SphereGeometry(0.1, 12, 10), bulb, { p: [x, 0.86, 0.26] }));
    sb.add(mesh(new THREE.SphereGeometry(0.1, 12, 10), bulb, { p: [x, -0.86, 0.26] }));
  }
  sb.position.set(0, 8.4, -6.6);
  g.add(sb);
  const rope = clay('#C9A27A', { bump: 1 });
  g.add(limb(V(-3.4, 9.3, -6.6), V(-3.6, 16, -6.6), 0.05, rope));
  g.add(limb(V(3.4, 9.3, -6.6), V(3.6, 16, -6.6), 0.05, rope));
}

function addCurtains(g) {
  for (const s of [-1, 1]) {
    const cg = new THREE.PlaneGeometry(9, 20, 120, 30);
    const p = cg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      const pinch = 1 - 0.35 * Math.exp(-((y + 3) ** 2) / 6) * ((x * s + 4.5) / 9);
      p.setXYZ(i, x * pinch + s * (1 - pinch) * 2, y, Math.sin(x * 2.1) * 0.45);
    }
    cg.computeVertexNormals();
    lumpy(cg, { amp: 0.05, freq: 0.8, mode: 'normal' });
    const cm = mesh(cg, clay('#D64545', { bump: 1.8, freq: 0.6 }), { p: [s * 13.2, 9.5, -8.5] });
    cm.material = cm.material.clone(); cm.material.side = THREE.DoubleSide; g.add(cm);
    g.add(mesh(lumpy(new THREE.TorusGeometry(0.55, 0.16, 14, 40), { amp: 0.01 }), clay('#FFD25A'), { p: [s * 12.2, 6.3, -7.9], r: [0, 0.4 * s, 0.4] }));
  }
}

export function makeConfetti(count = 80, { seed = 3, box = [12, 7, 5], center = [0, 4.5, 0.5] } = {}) {
  const g = new THREE.Group();
  const R = rng(seed);
  const cols = ['#FFD25A', '#FF6F91', '#2EC4B6', '#9B5DE5', '#FF8A3D', '#FFFDF4', '#74C94E'];
  for (let i = 0; i < count; i++) {
    const col = cols[i % cols.length];
    const geo = i % 3 === 0 ? new RoundedBoxGeometry(0.22, 0.06, 0.16, 2, 0.025) : new THREE.SphereGeometry(0.1, 14, 10);
    const m = mesh(geo, clay(col, { bump: 1 }), {
      p: [center[0] + (R() - 0.5) * box[0], center[1] + (R() - 0.5) * box[1], center[2] + (R() - 0.5) * box[2]],
      s: i % 3 === 0 ? 1 : [1.2, 0.45, 1.2], r: [R() * 3, R() * 3, R() * 3],
    });
    g.add(m);
  }
  return g;
}
