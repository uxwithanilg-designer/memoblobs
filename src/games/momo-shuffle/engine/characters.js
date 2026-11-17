// Clay cast: Momo (hero), Kranky (shuffle-master crab host), Tiki (level-keeper bird),
// plus game props (cups, number tiles).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clay, mesh, sphere, limb, lumpy, text3d, V } from './clay.js';

export const PAL = {
  momo: '#FF8A3D', momoDark: '#E0631F', cream: '#FFE3C2', leaf: '#74C94E', stem: '#4E8F33',
  ink: '#1B1420', white: '#FFFDF4', cheek: '#FF6F91', mouth: '#5A1E2B', tongue: '#FF5C74', brow: '#5A3420',
  crab: '#E8504F', crabDark: '#C93A3E', crabSpot: '#F58A7C', hat: '#2A2230', hatBand: '#D93A6A', bow: '#FFC93C', stache: '#4A2C1D',
  tiki: '#2EC4B6', tikiDark: '#1E9C91', tuft: '#9B5DE5', beak: '#FFAA1D',
  cup: '#8E6CE0', cupStripe: '#FFE3C2', cupStripe2: '#FFD25A', navy: '#23305A', wood: '#8A5A3B',
};

const eyeWhite = () => clay(PAL.white, { rough: 0.35, bump: 0.4, sheen: 0.2, gloss: 0.3, variation: 0.04 });
const pupilMat = () => clay(PAL.ink, { rough: 0.25, bump: 0.3, gloss: 0.6, variation: 0.0 });

// Googly clay eye. look = [-1..1, -1..1]
function addEye(g, pos, r, { look = [0, 0], pupil = 0.48, lid = 0, lidColor = PAL.momo, lidTilt = 0 } = {}) {
  const [x, y, z] = pos;
  g.add(mesh(sphere(r, { amp: 0.01 }), eyeWhite(), { p: [x, y, z], s: [1, 1.12, 0.62] }));
  const px = x + look[0] * r * 0.38, py = y + look[1] * r * 0.38;
  const pr = r * pupil;
  g.add(mesh(sphere(pr, { amp: 0.0 }), pupilMat(), { p: [px, py, z + r * 0.42], s: [1, 1.1, 0.55] }));
  g.add(mesh(new THREE.SphereGeometry(pr * 0.3, 16, 12), clay(PAL.white, { rough: 0.2, bump: 0, variation: 0 }),
    { p: [px + pr * 0.35, py + pr * 0.4, z + r * 0.42 + pr * 0.5] }));
  if (lid > 0) {
    const lg = new THREE.SphereGeometry(r * 1.07, 32, 16, 0, Math.PI * 2, 0, Math.PI * lid);
    const lm = mesh(lg, clay(lidColor), { p: [x, y, z], s: [1, 1.12, 0.66], r: [0.15, 0, lidTilt] });
    lm.material = lm.material.clone(); lm.material.side = THREE.DoubleSide;
    g.add(lm);
  }
}

function addMouth(g, type, [x, y, z], scale = 1, rotZ = 0) {
  const dark = clay(PAL.mouth, { rough: 0.5 });
  if (type === 'smile') {
    const t = new THREE.TorusGeometry(0.14 * scale, 0.034 * scale, 12, 32, Math.PI);
    g.add(mesh(t, dark, { p: [x, y, z], r: [0, 0, Math.PI + rotZ] }));
  } else if (type === 'grin') {
    const t = new THREE.SphereGeometry(0.16 * scale, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    g.add(mesh(t, dark, { p: [x, y + 0.03 * scale, z - 0.02], s: [1.25, 1.0, 0.5] }));
    g.add(mesh(sphere(0.07 * scale), clay(PAL.tongue), { p: [x, y - 0.08 * scale, z + 0.03], s: [1.3, 0.7, 0.6] }));
  } else if (type === 'oh') {
    g.add(mesh(sphere(0.12 * scale), dark, { p: [x, y, z], s: [1, 1.3, 0.45] }));
    g.add(mesh(sphere(0.06 * scale), clay(PAL.tongue), { p: [x, y - 0.07 * scale, z + 0.03], s: [1.2, 0.6, 0.5] }));
  } else if (type === 'scared') {
    g.add(mesh(sphere(0.13 * scale), dark, { p: [x, y, z], s: [1.7, 0.85, 0.45] }));
    g.add(mesh(new RoundedBoxGeometry(0.3 * scale, 0.06 * scale, 0.05, 2, 0.02), clay(PAL.white, { bump: 0.3 }),
      { p: [x, y + 0.06 * scale, z + 0.05] }));
  } else if (type === 'smirk') {
    const t = new THREE.TorusGeometry(0.16 * scale, 0.036 * scale, 12, 32, Math.PI * 0.75);
    g.add(mesh(t, dark, { p: [x, y, z], r: [0, 0, Math.PI + 0.55 + rotZ] }));
  }
}

// ---------------- MOMO ----------------
// expr: happy | grin | surprised | scared | sly
// arms: down | wave | up | cheer | hips
export function makeMomo({ expr = 'happy', look = [0, 0], arms = 'down', color = PAL.momo } = {}) {
  const g = new THREE.Group(); g.name = 'momo';
  const body = clay(color, { bump: 1.8 });
  const dark = clay(PAL.momoDark, { bump: 1.6 });
  g.add(mesh(sphere(1, { ws: 72, hs: 54, amp: 0.022 }), body, { p: [0, 1.05, 0], s: [1, 0.92, 0.95] }));
  g.add(mesh(sphere(0.62), clay(PAL.cream, { bump: 1.4 }), { p: [0, 0.8, 0.62], s: [1, 0.85, 0.55] }));

  // eyes
  const eyeLook = expr === 'scared' ? [0.6, -0.1] : look;
  const pupil = expr === 'surprised' || expr === 'scared' ? 0.36 : 0.5;
  const lid = expr === 'sly' ? 0.42 : 0;
  addEye(g, [-0.33, 1.33, 0.79], 0.26, { look: eyeLook, pupil, lid, lidColor: color });
  addEye(g, [0.33, 1.33, 0.79], 0.26, { look: eyeLook, pupil, lid, lidColor: color });

  // brows (inner, outer)
  const browMat = clay(PAL.brow, { bump: 0.8 });
  let inner = 1.70, outer = 1.68;
  if (expr === 'surprised') { inner = 1.78; outer = 1.76; }
  if (expr === 'scared') { inner = 1.80; outer = 1.68; }
  if (expr === 'sly') { inner = 1.64; outer = 1.72; }
  for (const s of [-1, 1]) g.add(limb(V(s * 0.16, inner, 0.66), V(s * 0.46, outer, 0.53), 0.042, browMat));

  // cheeks
  for (const s of [-1, 1]) g.add(mesh(sphere(0.12), clay(PAL.cheek, { bump: 1 }), { p: [s * 0.6, 1.08, 0.73], s: [1, 0.7, 0.35] }));

  // mouth
  const mouthType = { happy: 'smile', grin: 'grin', surprised: 'oh', scared: 'scared', sly: 'smirk' }[expr] || 'smile';
  if (mouthType === 'smile') addMouth(g, 'smile', [0, 1.06, 0.95], 1.25);
  else if (expr === 'sly') addMouth(g, 'smile', [0.1, 1.06, 0.94], 0.95, 0.35);
  else addMouth(g, mouthType, [0, 1.03, 0.92]);

  // arms
  const armMat = body;
  const hands = {
    down: [V(-1.22, 0.62, 0.3), V(1.22, 0.62, 0.3)],
    wave: [V(-1.22, 0.62, 0.3), V(1.42, 1.85, 0.25)],
    up: [V(-1.35, 1.9, 0.2), V(1.35, 1.9, 0.2)],
    cheer: [V(-1.5, 1.6, 0.4), V(1.5, 1.6, 0.4)],
    hips: [V(-1.05, 0.75, 0.55), V(1.05, 0.75, 0.55)],
  }[arms];
  for (const [i, s] of [-1, 1].entries()) {
    const sh = V(s * 0.88, 1.0, 0.15);
    const h = hands[i];
    g.add(limb(sh, h, 0.12, armMat));
    g.add(mesh(sphere(0.15), armMat, { p: [h.x, h.y, h.z] }));
  }

  // feet
  for (const s of [-1, 1]) g.add(mesh(sphere(0.3), dark, { p: [s * 0.42, 0.14, 0.25], s: [1.05, 0.5, 1.35] }));

  // sprout
  const stem = clay(PAL.stem, { bump: 1 }), leaf = clay(PAL.leaf, { bump: 1.4 });
  g.add(limb(V(0, 1.88, 0), V(0.06, 2.25, 0), 0.045, stem));
  g.add(mesh(sphere(0.17), leaf, { p: [-0.1, 2.3, 0], s: [1.7, 0.35, 0.75], r: [0, 0, -0.45] }));
  g.add(mesh(sphere(0.17), leaf, { p: [0.24, 2.33, 0], s: [1.7, 0.35, 0.75], r: [0, 0, 0.5] }));
  return g;
}

// ---------------- KRANKY ----------------
// Claw targets are in the crab's local space.
export function makeKranky({ expr = 'smirk', clawL = V(-2.2, 1.5, 1.4), clawR = V(2.2, 1.5, 1.4), open = 0.5, hat = true } = {}) {
  const g = new THREE.Group(); g.name = 'kranky';
  const shell = clay(PAL.crab, { bump: 1.8 });
  const dark = clay(PAL.crabDark, { bump: 1.6 });
  const B = { y: 1.35, sx: 1.55, sy: 0.95, sz: 1.1 };
  const top = (x, z) => B.y + B.sy * Math.sqrt(Math.max(0, 1 - (x / B.sx) ** 2 - (z / B.sz) ** 2));
  g.add(mesh(sphere(1, { ws: 72, hs: 54 }), shell, { p: [0, B.y, 0], s: [B.sx, B.sy, B.sz] }));
  // shell spots
  for (const [x, z, r] of [[-0.75, -0.25, 0.2], [0.85, -0.1, 0.16], [0.3, -0.6, 0.14], [-0.3, 0.35, 0.12], [1.1, 0.35, 0.11]])
    g.add(mesh(sphere(r), clay(PAL.crabSpot), { p: [x, top(x, z) - 0.03, z], s: [1, 0.4, 1] }));

  // eye stalks + eyes
  const shock = expr === 'shock';
  for (const s of [-1, 1]) {
    g.add(limb(V(s * 0.55, 2.0, 0.35), V(s * 0.76, 2.72, 0.45), 0.085, shell));
    addEye(g, [s * 0.8, 2.95, 0.5], 0.3, {
      look: shock ? [0, 0] : [-s * 0.1, -0.35], pupil: shock ? 0.3 : 0.48,
      lid: shock ? 0 : 0.4, lidColor: PAL.crab, lidTilt: s * -0.18,
    });
  }

  // top hat
  if (hat) {
    const hg = new THREE.Group();
    const hm = clay(PAL.hat, { bump: 1.2, rough: 0.5 });
    hg.add(mesh(lumpy(new THREE.CylinderGeometry(0.58, 0.58, 0.07, 48), { amp: 0.01 }), hm, { p: [0, 0.03, 0] }));
    hg.add(mesh(lumpy(new THREE.CylinderGeometry(0.36, 0.4, 0.62, 48, 4), { amp: 0.015 }), hm, { p: [0, 0.36, 0] }));
    hg.add(mesh(lumpy(new THREE.CylinderGeometry(0.405, 0.41, 0.13, 48), { amp: 0.008 }), clay(PAL.hatBand), { p: [0, 0.14, 0] }));
    hg.position.set(0.05, top(0, -0.15) - 0.03, -0.15);
    hg.rotation.set(-0.1, 0, -0.14);
    g.add(hg);
  }

  // mustache
  const st = clay(PAL.stache, { bump: 1.4 });
  for (const s of [-1, 1]) {
    g.add(mesh(sphere(0.15), st, { p: [s * 0.24, 1.62, 1.03], s: [2.1, 0.75, 0.8], r: [0, 0, s * 0.3] }));
    g.add(mesh(sphere(0.085), st, { p: [s * 0.55, 1.74, 0.94] }));
  }
  // mouth
  if (shock) addMouth(g, 'oh', [0, 1.3, 1.05], 1.5);
  else addMouth(g, 'smirk', [0.06, 1.38, 1.07], 1.1);

  // bow tie
  const bow = clay(PAL.bow, { bump: 1 });
  g.add(mesh(sphere(0.1), bow, { p: [0, 1.04, 1.05] }));
  g.add(mesh(lumpy(new THREE.ConeGeometry(0.19, 0.34, 24), { amp: 0.01 }), bow, { p: [-0.21, 1.04, 1.02], r: [0, 0, -Math.PI / 2] }));
  g.add(mesh(lumpy(new THREE.ConeGeometry(0.19, 0.34, 24), { amp: 0.01 }), bow, { p: [0.21, 1.04, 1.02], r: [0, 0, Math.PI / 2] }));

  // legs
  for (const s of [-1, 1]) for (const k of [-0.55, 0, 0.55]) {
    const knee = V(s * 1.85, 0.75, k * 1.25), foot = V(s * 2.05, 0.04, k * 1.4);
    g.add(limb(V(s * 1.25, 1.0, k), knee, 0.085, dark));
    g.add(limb(knee, foot, 0.075, dark));
  }

  // claws
  for (const [s, target] of [[-1, clawL], [1, clawR]]) {
    const shoulder = V(s * 1.35, 1.45, 0.45);
    const dir = new THREE.Vector3().subVectors(target, shoulder).normalize();
    const wrist = target.clone().addScaledVector(dir, -0.45);
    const elbow = shoulder.clone().lerp(wrist, 0.5).add(V(s * 0.35, 0.35, 0));
    g.add(limb(shoulder, elbow, 0.13, shell));
    g.add(limb(elbow, wrist, 0.12, shell));
    const cg = new THREE.Group();
    cg.add(mesh(sphere(0.32), shell, { p: [0, 0, -0.1], s: [1, 0.9, 1.1] }));
    const upper = new THREE.Group(); upper.rotation.x = -open * 0.6;
    upper.add(mesh(sphere(0.36), shell, { p: [0, 0.08, 0.32], s: [0.9, 0.55, 1.3] }));
    upper.add(mesh(sphere(0.07), clay(PAL.crabSpot), { p: [0.12, 0.25, 0.3] }));
    const lower = new THREE.Group(); lower.rotation.x = open * 0.6;
    lower.add(mesh(sphere(0.28), dark, { p: [0, -0.1, 0.28], s: [0.85, 0.5, 1.2] }));
    cg.add(upper, lower);
    cg.position.copy(wrist).addScaledVector(dir, 0.2);
    cg.quaternion.setFromUnitVectors(V(0, 0, 1), dir);
    g.add(cg);
  }
  return g;
}

// ---------------- TIKI ----------------
export function makeTiki({ sign = null, look = [0, 0], expr = 'happy', signSide = 1 } = {}) {
  const g = new THREE.Group(); g.name = 'tiki';
  const body = clay(PAL.tiki, { bump: 1.8 });
  g.add(mesh(sphere(0.7, { ws: 64, hs: 48 }), body, { p: [0, 0.85, 0], s: [1, 1.05, 0.95] }));
  g.add(mesh(sphere(0.48), clay(PAL.cream, { bump: 1.3 }), { p: [0, 0.68, 0.42], s: [1, 1, 0.45] }));
  for (const s of [-1, 1]) addEye(g, [s * 0.22, 1.1, 0.53], 0.17, { look, pupil: expr === 'surprised' ? 0.38 : 0.52 });
  // beak
  const bk = clay(PAL.beak, { bump: 1 });
  g.add(mesh(lumpy(new THREE.ConeGeometry(0.12, 0.28, 24), { amp: 0.008 }), bk, { p: [0, 0.9, 0.72], r: [Math.PI / 2, 0, 0] }));
  // cheeks
  for (const s of [-1, 1]) g.add(mesh(sphere(0.07), clay(PAL.cheek), { p: [s * 0.4, 0.92, 0.5], s: [1, 0.7, 0.4] }));
  // tuft
  for (const [x, rz] of [[-0.1, 0.45], [0, 0], [0.1, -0.45]])
    g.add(mesh(sphere(0.1), clay(PAL.tuft), { p: [x, 1.66, -0.02], s: [0.6, 1.7, 0.6], r: [0, 0, rz] }));
  // wings
  const wd = clay(PAL.tikiDark, { bump: 1.5 });
  g.add(mesh(sphere(0.28), wd, { p: [-signSide * 0.68, 0.82, 0], s: [0.35, 1, 0.75], r: [0, 0, signSide * 0.25] }));
  const holdX = signSide * 0.95;
  if (sign) g.add(mesh(sphere(0.28), wd, { p: [signSide * 0.72, 1.0, 0.18], s: [0.35, 1, 0.75], r: [0, 0, -signSide * 1.0] }));
  else g.add(mesh(sphere(0.28), wd, { p: [signSide * 0.68, 0.82, 0], s: [0.35, 1, 0.75], r: [0, 0, -signSide * 0.25] }));
  // legs
  const lg = clay(PAL.beak, { bump: 0.8 });
  for (const s of [-1, 1]) {
    g.add(limb(V(s * 0.2, 0.3, 0.1), V(s * 0.22, 0.04, 0.16), 0.045, lg));
    g.add(mesh(sphere(0.1), lg, { p: [s * 0.22, 0.04, 0.26], s: [1.4, 0.4, 1.6] }));
  }
  // sign
  if (sign) {
    g.add(limb(V(holdX, 0.05, 0.3), V(holdX, 2.25, 0.3), 0.045, clay(PAL.wood, { bump: 1.2 })));
    const board = new THREE.Group();
    board.add(mesh(new RoundedBoxGeometry(1.55, 0.9, 0.16, 4, 0.07), clay(PAL.cream, { bump: 1.6, freq: 1.2 })));
    const t = text3d(sign, { size: Math.min(0.36, 1.2 / (sign.length * 0.72)), depth: 0.06, color: PAL.navy, bevel: 0.016 });
    t.position.z = 0.12;
    board.add(t);
    board.position.set(holdX, 2.6, 0.32);
    board.rotation.z = signSide * -0.06;
    g.add(board);
  }
  return g;
}

// ---------------- PROPS ----------------
export function makeCup({ color = PAL.cup } = {}) {
  const g = new THREE.Group(); g.name = 'cup';
  const m = clay(color, { bump: 1.8, freq: 0.9 });
  g.add(mesh(lumpy(new THREE.CylinderGeometry(0.82, 1.15, 2.2, 72, 12), { amp: 0.025, freq: 1.8 }), m, { p: [0, 1.1, 0] }));
  const rOf = (y) => 1.15 - 0.15 * y;
  g.add(mesh(lumpy(new THREE.TorusGeometry(rOf(0.6), 0.075, 14, 72), { amp: 0.01 }), clay(PAL.cupStripe), { p: [0, 0.6, 0], r: [Math.PI / 2, 0, 0] }));
  g.add(mesh(lumpy(new THREE.TorusGeometry(rOf(1.5), 0.065, 14, 72), { amp: 0.01 }), clay(PAL.cupStripe2), { p: [0, 1.5, 0], r: [Math.PI / 2, 0, 0] }));
  g.add(mesh(lumpy(new THREE.TorusGeometry(1.15, 0.09, 14, 72), { amp: 0.012 }), clay(PAL.cupStripe), { p: [0, 0.07, 0], r: [Math.PI / 2, 0, 0] }));
  g.add(mesh(sphere(0.26), clay(PAL.cupStripe), { p: [0, 2.3, 0], s: [1, 0.85, 1] }));
  // little clay dots
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    g.add(mesh(sphere(0.07), clay(PAL.cupStripe2), { p: [Math.sin(a) * rOf(1.05), 1.05, Math.cos(a) * rOf(1.05)], s: [1, 1, 0.5], r: [0, a, 0] }));
  }
  return g;
}

export function makeTile(label, { color = PAL.cream, ink = PAL.navy } = {}) {
  const g = new THREE.Group();
  g.add(mesh(new RoundedBoxGeometry(0.95, 0.95, 0.2, 4, 0.08), clay(color, { bump: 1.5, freq: 1.4 })));
  const t = text3d(label, { size: 0.5, depth: 0.08, color: ink, bevel: 0.025 });
  t.position.z = 0.15; g.add(t);
  g.rotation.x = -0.35;
  return g;
}
