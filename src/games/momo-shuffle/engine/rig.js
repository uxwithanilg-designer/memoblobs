// Animatable clay rigs: Momo, Kranky, Tiki, cups, tiles, confetti.
// Each rig is built once per video; update(state) poses it per frame.
import * as THREE from 'three';
import { clay, mesh, sphere, lumpy, limb, V, rng } from './clay.js';
import { PAL, makeCup, makeTile, makeTiki } from './characters.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const Y = V(0, 1, 0), Z = V(0, 0, 1);
const tmp = new THREE.Vector3();

export class Limb {
  constructor(r, mat) {
    this.g = new THREE.Group();
    this.cyl = mesh(lumpy(new THREE.CylinderGeometry(r, r, 1, 20, 8), { amp: r * 0.08, freq: 2.2 / r }), mat);
    this.j1 = mesh(sphere(r), mat); this.j2 = mesh(sphere(r), mat);
    this.g.add(this.cyl, this.j1, this.j2);
  }
  set(a, b) {
    const d = tmp.subVectors(b, a); const len = Math.max(0.001, d.length());
    this.cyl.position.copy(a).addScaledVector(d, 0.5);
    this.cyl.scale.set(1, len, 1);
    this.cyl.quaternion.setFromUnitVectors(Y, d.divideScalar(len));
    this.j1.position.copy(a); this.j2.position.copy(b);
  }
}

const eyeWhite = () => clay(PAL.white, { rough: 0.35, bump: 0.4, sheen: 0.2, gloss: 0.3, variation: 0.04 });
const pupilMat = () => clay(PAL.ink, { rough: 0.25, bump: 0.3, gloss: 0.6, variation: 0.0 });

class Eye {
  constructor(parent, pos, r, lidColor) {
    this.r = r;
    this.g = new THREE.Group(); this.g.position.set(...pos); parent.add(this.g);
    this.g.add(mesh(sphere(r, { amp: 0.01 }), eyeWhite(), { s: [1, 1.12, 0.62] }));
    this.pupil = new THREE.Group(); this.g.add(this.pupil);
    const pr = r * 0.5;
    this.pupil.add(mesh(sphere(pr, { amp: 0 }), pupilMat(), { s: [1, 1.1, 0.55] }));
    this.pupil.add(mesh(new THREE.SphereGeometry(pr * 0.3, 16, 12), clay(PAL.white, { rough: 0.2, bump: 0, variation: 0 }), { p: [pr * 0.35, pr * 0.4, pr * 0.5] }));
    const lm = clay(lidColor).clone(); lm.side = THREE.DoubleSide;
    this.lid = mesh(new THREE.SphereGeometry(r * 1.07, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42), lm, { s: [1, 1.12, 0.66], r: [0.15, 0, 0] });
    this.g.add(this.lid);
  }
  set({ look = [0, 0], pupil = 1, lid = false, lidTilt = 0, blink = 0, squint = 1 }) {
    this.pupil.position.set(look[0] * this.r * 0.38, look[1] * this.r * 0.38, this.r * 0.42);
    this.pupil.scale.setScalar(pupil);
    this.lid.visible = lid; this.lid.rotation.z = lidTilt;
    this.g.scale.y = Math.max(0.12, (1 - blink) * squint);
  }
}

function mouthGroup(type, pos, scale = 1, rotZ = 0) {
  const g = new THREE.Group(); g.position.set(...pos);
  const dark = clay(PAL.mouth, { rough: 0.5 });
  if (type === 'smile') {
    g.add(mesh(new THREE.TorusGeometry(0.14 * scale, 0.034 * scale, 12, 32, Math.PI), dark, { r: [0, 0, Math.PI + rotZ] }));
  } else if (type === 'grin') {
    g.add(mesh(new THREE.SphereGeometry(0.16 * scale, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), dark, { p: [0, 0.03 * scale, -0.02], s: [1.25, 1, 0.5] }));
    g.add(mesh(sphere(0.07 * scale), clay(PAL.tongue), { p: [0, -0.08 * scale, 0.03], s: [1.3, 0.7, 0.6] }));
  } else if (type === 'oh') {
    g.add(mesh(sphere(0.12 * scale), dark, { s: [1, 1.3, 0.45] }));
    g.add(mesh(sphere(0.06 * scale), clay(PAL.tongue), { p: [0, -0.07 * scale, 0.03], s: [1.2, 0.6, 0.5] }));
  } else if (type === 'scared') {
    g.add(mesh(sphere(0.13 * scale), dark, { s: [1.7, 0.85, 0.45] }));
    g.add(mesh(new RoundedBoxGeometry(0.3 * scale, 0.06 * scale, 0.05, 2, 0.02), clay(PAL.white, { bump: 0.3 }), { p: [0, 0.06 * scale, 0.05] }));
  } else if (type === 'smirk') {
    g.add(mesh(new THREE.TorusGeometry(0.16 * scale, 0.036 * scale, 12, 32, Math.PI * 0.75), dark, { r: [0, 0, Math.PI + 0.55 + rotZ] }));
  }
  return g;
}

// ---------------- MOMO ----------------
export const MOMO_ARMS = {
  down: [V(-1.22, 0.62, 0.3), V(1.22, 0.62, 0.3)],
  tuck: [V(-1.0, 0.7, 0.45), V(1.0, 0.7, 0.45)],
  up: [V(-1.35, 1.9, 0.2), V(1.35, 1.9, 0.2)],
  cheer: [V(-1.5, 1.6, 0.4), V(1.5, 1.6, 0.4)],
  hips: [V(-1.05, 0.75, 0.55), V(1.05, 0.75, 0.55)],
};
export function waveArms(t) {
  const a = Math.sin(t * 14) * 0.28;
  return [MOMO_ARMS.down[0], V(1.42 + a, 1.85 - Math.abs(a) * 0.3, 0.25)];
}

export class MomoRig {
  constructor() {
    this.root = new THREE.Group(); this.root.name = 'momo';
    this.body = new THREE.Group(); this.root.add(this.body);
    const bodyM = clay(PAL.momo, { bump: 1.8 });
    const B = this.body;
    B.add(mesh(sphere(1, { ws: 72, hs: 54, amp: 0.022 }), bodyM, { p: [0, 1.05, 0], s: [1, 0.92, 0.95] }));
    B.add(mesh(sphere(0.62), clay(PAL.cream, { bump: 1.4 }), { p: [0, 0.8, 0.62], s: [1, 0.85, 0.55] }));
    for (const s of [-1, 1]) B.add(mesh(sphere(0.12), clay(PAL.cheek, { bump: 1 }), { p: [s * 0.6, 1.08, 0.73], s: [1, 0.7, 0.35] }));
    for (const s of [-1, 1]) B.add(mesh(sphere(0.3), clay(PAL.momoDark, { bump: 1.6 }), { p: [s * 0.42, 0.14, 0.25], s: [1.05, 0.5, 1.35] }));
    this.eyes = [new Eye(B, [-0.33, 1.33, 0.79], 0.26, PAL.momo), new Eye(B, [0.33, 1.33, 0.79], 0.26, PAL.momo)];
    // faces
    const browM = clay(PAL.brow, { bump: 0.8 });
    const brow = { happy: [1.70, 1.68], grin: [1.70, 1.68], surprised: [1.78, 1.76], scared: [1.80, 1.68], sly: [1.64, 1.72] };
    const mouth = {
      happy: () => mouthGroup('smile', [0, 1.06, 0.95], 1.25), grin: () => mouthGroup('grin', [0, 1.03, 0.92]),
      surprised: () => mouthGroup('oh', [0, 1.03, 0.92]), scared: () => mouthGroup('scared', [0, 1.03, 0.92]),
      sly: () => mouthGroup('smile', [0.1, 1.06, 0.94], 0.95, 0.35),
    };
    this.faces = {};
    for (const k of Object.keys(brow)) {
      const f = new THREE.Group();
      for (const s of [-1, 1]) f.add(limb(V(s * 0.16, brow[k][0], 0.66), V(s * 0.46, brow[k][1], 0.53), 0.042, browM));
      f.add(mouth[k]());
      this.faces[k] = f; B.add(f);
    }
    // arms
    this.arms = [new Limb(0.12, bodyM), new Limb(0.12, bodyM)];
    this.hands = [mesh(sphere(0.15), bodyM), mesh(sphere(0.15), bodyM)];
    this.arms.forEach((a) => B.add(a.g)); this.hands.forEach((h) => B.add(h));
    // sprout
    this.sprout = new THREE.Group(); this.sprout.position.set(0, 1.88, 0); B.add(this.sprout);
    this.sprout.add(limb(V(0, 0, 0), V(0.06, 0.37, 0), 0.045, clay(PAL.stem, { bump: 1 })));
    const leaf = clay(PAL.leaf, { bump: 1.4 });
    this.sprout.add(mesh(sphere(0.17), leaf, { p: [-0.1, 0.42, 0], s: [1.7, 0.35, 0.75], r: [0, 0, -0.45] }));
    this.sprout.add(mesh(sphere(0.17), leaf, { p: [0.24, 0.45, 0], s: [1.7, 0.35, 0.75], r: [0, 0, 0.5] }));
  }
  update(s) {
    const r = this.root;
    r.visible = s.visible !== false;
    r.position.set(s.x ?? 0, s.y ?? 0, s.z ?? 0);
    r.rotation.set(0, s.ry ?? 0, s.rz ?? 0);
    r.scale.setScalar(s.scale ?? 1);
    const sq = s.squash ?? 1;
    this.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    const expr = s.expr || 'happy';
    for (const k in this.faces) this.faces[k].visible = k === expr;
    const pupil = expr === 'surprised' || expr === 'scared' ? 0.72 : 1;
    let look = s.look || [0, 0];
    if (expr === 'scared' && !s.look) look = [0.6, -0.1];
    for (const e of this.eyes) e.set({ look, pupil, lid: expr === 'sly', blink: s.blink || 0 });
    const [hl, hr] = s.arms || MOMO_ARMS.down;
    [hl, hr].forEach((h, i) => {
      const sh = V(i ? 0.88 : -0.88, 1.0, 0.15);
      this.arms[i].set(sh, h); this.hands[i].position.copy(h);
    });
    this.sprout.rotation.z = s.sprout ?? 0;
  }
}

// ---------------- KRANKY ----------------
export class KrankyRig {
  constructor({ scale = 1 } = {}) {
    this.root = new THREE.Group(); this.root.name = 'kranky';
    this.root.scale.setScalar(scale); this.k = scale;
    this.bodyG = new THREE.Group(); this.root.add(this.bodyG);
    const g = this.bodyG;
    const shell = clay(PAL.crab, { bump: 1.8 }), dark = clay(PAL.crabDark, { bump: 1.6 });
    this.shell = shell; this.dark = dark;
    const B = { y: 1.35, sx: 1.55, sy: 0.95, sz: 1.1 };
    const top = (x, z) => B.y + B.sy * Math.sqrt(Math.max(0, 1 - (x / B.sx) ** 2 - (z / B.sz) ** 2));
    g.add(mesh(sphere(1, { ws: 72, hs: 54 }), shell, { p: [0, B.y, 0], s: [B.sx, B.sy, B.sz] }));
    for (const [x, z, r] of [[-0.75, -0.25, 0.2], [0.85, -0.1, 0.16], [0.3, -0.6, 0.14], [-0.3, 0.35, 0.12], [1.1, 0.35, 0.11]])
      g.add(mesh(sphere(r), clay(PAL.crabSpot), { p: [x, top(x, z) - 0.03, z], s: [1, 0.4, 1] }));
    this.eyes = [];
    for (const s of [-1, 1]) {
      g.add(limb(V(s * 0.55, 2.0, 0.35), V(s * 0.76, 2.72, 0.45), 0.085, shell));
      this.eyes.push(new Eye(g, [s * 0.8, 2.95, 0.5], 0.3, PAL.crab));
    }
    const hg = new THREE.Group(), hm = clay(PAL.hat, { bump: 1.2, rough: 0.5 });
    hg.add(mesh(lumpy(new THREE.CylinderGeometry(0.58, 0.58, 0.07, 48), { amp: 0.01 }), hm, { p: [0, 0.03, 0] }));
    hg.add(mesh(lumpy(new THREE.CylinderGeometry(0.36, 0.4, 0.62, 48, 4), { amp: 0.015 }), hm, { p: [0, 0.36, 0] }));
    hg.add(mesh(lumpy(new THREE.CylinderGeometry(0.405, 0.41, 0.13, 48), { amp: 0.008 }), clay(PAL.hatBand), { p: [0, 0.14, 0] }));
    hg.position.set(0.05, top(0, -0.15) - 0.03, -0.15); hg.rotation.set(-0.1, 0, -0.14);
    this.hat = hg; g.add(hg);
    const st = clay(PAL.stache, { bump: 1.4 });
    for (const s of [-1, 1]) {
      g.add(mesh(sphere(0.15), st, { p: [s * 0.24, 1.62, 1.03], s: [2.1, 0.75, 0.8], r: [0, 0, s * 0.3] }));
      g.add(mesh(sphere(0.085), st, { p: [s * 0.55, 1.74, 0.94] }));
    }
    this.mouths = { smirk: mouthGroup('smirk', [0.06, 1.38, 1.07], 1.1), shock: mouthGroup('oh', [0, 1.3, 1.05], 1.5), laugh: mouthGroup('grin', [0, 1.36, 1.04], 1.5) };
    for (const k in this.mouths) g.add(this.mouths[k]);
    const bow = clay(PAL.bow, { bump: 1 });
    g.add(mesh(sphere(0.1), bow, { p: [0, 1.04, 1.05] }));
    g.add(mesh(lumpy(new THREE.ConeGeometry(0.19, 0.34, 24), { amp: 0.01 }), bow, { p: [-0.21, 1.04, 1.02], r: [0, 0, -Math.PI / 2] }));
    g.add(mesh(lumpy(new THREE.ConeGeometry(0.19, 0.34, 24), { amp: 0.01 }), bow, { p: [0.21, 1.04, 1.02], r: [0, 0, Math.PI / 2] }));
    for (const s of [-1, 1]) for (const k of [-0.55, 0, 0.55]) {
      const knee = V(s * 1.85, 0.75, k * 1.25), foot = V(s * 2.05, 0.04, k * 1.4);
      this.root.add(limb(V(s * 1.25, 1.0, k), knee, 0.085, dark));
      this.root.add(limb(knee, foot, 0.075, dark));
    }
    // claws
    this.claws = [-1, 1].map((s) => {
      const c = { s, upper: new Limb(0.13, shell), lower: new Limb(0.12, shell), g: new THREE.Group(), top: new THREE.Group(), bot: new THREE.Group() };
      c.g.add(mesh(sphere(0.32), shell, { p: [0, 0, -0.1], s: [1, 0.9, 1.1] }));
      c.top.add(mesh(sphere(0.36), shell, { p: [0, 0.08, 0.32], s: [0.9, 0.55, 1.3] }));
      c.top.add(mesh(sphere(0.07), clay(PAL.crabSpot), { p: [0.12, 0.25, 0.3] }));
      c.bot.add(mesh(sphere(0.28), dark, { p: [0, -0.1, 0.28], s: [0.85, 0.5, 1.2] }));
      c.g.add(c.top, c.bot);
      this.root.add(c.upper.g, c.lower.g, c.g);
      return c;
    });
  }
  // claw targets in WORLD space
  update(s) {
    const r = this.root;
    r.position.set(s.x ?? 0, (s.y ?? 0), s.z ?? 0);
    this.bodyG.position.y = s.bob ?? 0;
    this.bodyG.rotation.z = s.tilt ?? 0;
    const expr = s.expr || 'smirk';
    for (const k in this.mouths) this.mouths[k].visible = k === expr;
    this.eyes.forEach((e, i) => {
      const sd = i ? 1 : -1;
      if (expr === 'shock') e.set({ look: s.look || [0, 0], pupil: 0.62, lid: false, blink: s.blink || 0 });
      else if (expr === 'laugh') e.set({ look: [0, -0.2], pupil: 1, lid: true, lidTilt: sd * -0.18, squint: 0.75, blink: s.blink || 0 });
      else e.set({ look: s.look || [-sd * 0.1, -0.35], pupil: 1, lid: true, lidTilt: sd * -0.18, blink: s.blink || 0 });
    });
    this.hat.position.y = 2.26 + (expr === 'shock' ? 0.25 : 0) + (s.hatHop ?? 0);
    const tgts = [s.clawL, s.clawR];
    this.claws.forEach((c, i) => {
      const T = tgts[i]; if (!T) return;
      const target = T.p.clone().sub(r.position).divideScalar(this.k);
      target.y -= this.bodyG.position.y * 0;
      const shoulder = V(c.s * 1.35, 1.45 + this.bodyG.position.y, 0.45);
      const dir = new THREE.Vector3().subVectors(target, shoulder).normalize();
      const wrist = target.clone().addScaledVector(dir, -0.45);
      const elbow = shoulder.clone().lerp(wrist, 0.5).add(V(c.s * 0.4, 0.45, 0));
      c.upper.set(shoulder, elbow); c.lower.set(elbow, wrist);
      c.g.position.copy(wrist).addScaledVector(dir, 0.2);
      c.g.quaternion.setFromUnitVectors(Z, dir);
      const open = T.open ?? 0.4;
      c.top.rotation.x = -open * 0.6; c.bot.rotation.x = open * 0.6;
    });
  }
}

// ---------------- TIKI ----------------
export class TikiRig {
  constructor(sign, { signSide = 1, scale = 1 } = {}) {
    this.root = new THREE.Group(); this.root.name = 'tiki';
    this.inner = new THREE.Group(); this.root.add(this.inner);
    this.scale = scale; this.signSide = signSide;
    this.setSign(sign);
  }
  setSign(sign, expr = 'happy') {
    if (this.cur === sign + expr) return;
    this.cur = sign + expr;
    if (this.model) { this.inner.remove(this.model); this.model.traverse((o) => o.geometry && o.geometry.dispose()); }
    this.model = makeTiki({ sign, signSide: this.signSide, expr });
    this.inner.add(this.model);
  }
  update(s) {
    const r = this.root;
    r.visible = s.visible !== false;
    r.position.set(s.x ?? 0, s.y ?? 0, s.z ?? 0);
    r.rotation.y = s.ry ?? 0;
    r.scale.setScalar(this.scale);
    const sq = s.squash ?? 1;
    this.inner.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    this.inner.rotation.z = s.rz ?? 0;
  }
}

// ---------------- CUPS / TILES / CONFETTI ----------------
export class CupRig {
  constructor() { this.root = makeCup(); }
  update(s) {
    this.root.position.set(s.x, s.y ?? 0, s.z ?? 0);
    this.root.rotation.set(0, s.ry ?? 0, s.rz ?? 0);
    const sq = s.squash ?? 1; this.root.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
  }
  knob() { return this.root.localToWorld(V(0, 2.55, 0.12)); }
}

export class TileRig {
  constructor(label) { this.root = makeTile(label); this.base = this.root.rotation.x; }
  update(s) {
    this.root.visible = (s.scale ?? 1) > 0.01;
    this.root.position.set(s.x, 0.42 * (s.scale ?? 1), s.z);
    this.root.scale.setScalar(Math.max(0.001, s.scale ?? 1));
  }
}

export class Confetti {
  constructor(count = 90, seed = 5) {
    this.root = new THREE.Group();
    const R = rng(seed);
    const cols = ['#FFD25A', '#FF6F91', '#2EC4B6', '#9B5DE5', '#FF8A3D', '#FFFDF4', '#74C94E'];
    this.p = [];
    for (let i = 0; i < count; i++) {
      const geo = i % 3 === 0 ? new RoundedBoxGeometry(0.22, 0.06, 0.16, 2, 0.025) : new THREE.SphereGeometry(0.1, 12, 8);
      const m = mesh(geo, clay(cols[i % cols.length], { bump: 1 }), { s: i % 3 === 0 ? 1 : [1.2, 0.45, 1.2] });
      m.castShadow = false;
      const a = R() * Math.PI * 2, up = 6 + R() * 7, out = 1.5 + R() * 4;
      this.p.push({ m, v: V(Math.cos(a) * out, up, Math.sin(a) * out * 0.6 + 1.2), spin: V(R() * 9, R() * 9, R() * 9), r0: V(R() * 3, R() * 3, R() * 3) });
      this.root.add(m);
    }
    this.root.visible = false;
  }
  update(t, t0, origin) {
    if (t0 == null || t < t0) { this.root.visible = false; return; }
    const dt = t - t0;
    this.root.visible = dt < 5;
    for (const q of this.p) {
      const drag = 1 - Math.exp(-dt * 1.4);
      const x = origin.x + q.v.x * drag / 1.4, z = origin.z + q.v.z * drag / 1.4;
      let y = origin.y + q.v.y * drag / 1.4 - 4.5 * dt * dt * 0.5 - 1.2 * dt;
      const landed = y < 0.06; if (landed) y = 0.06;
      q.m.position.set(x, y, z);
      const sp = landed ? 0 : dt;
      q.m.rotation.set(q.r0.x + q.spin.x * sp, q.r0.y + q.spin.y * sp, q.r0.z + q.spin.z * sp);
    }
  }
}

// Stop-motion "boil": tiny per-frame jitter so the clay feels hand-animated.
export function boil(obj, frame, salt, amt = 1) {
  const R = rng(frame * 7919 + salt * 104729);
  obj.position.x += (R() - 0.5) * 0.02 * amt;
  obj.position.y += (R() - 0.5) * 0.012 * amt;
  obj.position.z += (R() - 0.5) * 0.02 * amt;
  obj.rotation.y += (R() - 0.5) * 0.012 * amt;
  obj.rotation.z += (R() - 0.5) * 0.01 * amt;
}
