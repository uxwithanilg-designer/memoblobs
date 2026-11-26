// Bolt Security. Robots teleport in near you once the alarm trips (Baron Bolt's teleport pads are everywhere) and:
//  - guards keep a middle distance, strafe and fire blaster bursts when they can see you;
//  - hounds run you down and bite; riot bots walk in behind a plate shield that blocks your shots from the front;
//  - heavies hang back and fire rockets that blow holes in walls; drones hover and strafe overhead;
//  - turrets on the walls wake with the alarm and track you — break the wall under one and it falls;
//  - the Vault Warden stomps in, fires cannon bursts and missiles, and calls in reinforcements.
// Robots climb a block, jump when a wall stops them, and teleport back in if they stay stuck.
import * as THREE from "three";
import { BOTS, type BotSpec } from "./gear";
import { botRig, type Rig } from "./art/rigs";
import { fallBody, moveBody, unstick, type Body } from "./physics";
import type { VoxelWorld } from "./voxels";
import type { BotKind } from "./districts";
import { angDiff, clamp } from "./util";

export interface Bot extends Body {
  id: number; kind: BotKind | "warden"; spec: BotSpec; rig: Rig; elite: boolean;
  yaw: number; pitch: number; hp: number; maxHp: number; alive: boolean; dead: number;
  fireT: number; burst: number; thinkT: number; strafe: number; strafeT: number; stuck: number; spawnT: number; flash: number;
  walk: number; speed: number; recoil: number; special: number; summon: number;
  /** turrets: the block they're bolted to */
  mount: { x: number; y: number; z: number } | null;
}
export interface Shot { from: Bot; x: number; y: number; z: number; tx: number; ty: number; tz: number; kind: "bolt" | "rocket" | "cannon" }
export interface BotWorld { w: VoxelWorld; px: number; py: number; pz: number; pAlive: boolean; d: number; g: number; t: number }

let NEXT = 1;
export function makeBot(kind: BotKind | "warden", elite: boolean, x: number, y: number, z: number, hpScale: number): Bot {
  const spec = BOTS[kind];
  const rig = botRig(kind, elite);
  const hp = spec.hp * hpScale * (elite ? 1.8 : 1);
  rig.root.position.set(x, y, z);
  return {
    id: NEXT++, kind, spec, rig, elite, x, y, z, vx: 0, vy: 0, vz: 0, hw: kind === "warden" ? 0.9 : kind === "hound" ? 0.3 : 0.32, h: kind === "drone" ? 0.5 : Math.min(2.4, rig.height),
    grounded: false, yaw: 0, pitch: 0, hp, maxHp: hp, alive: true, dead: 0, fireT: 1 + Math.random(), burst: 0, thinkT: 0, strafe: Math.random() < 0.5 ? 1 : -1, strafeT: 0,
    stuck: 0, spawnT: kind === "turret" ? 0 : 0.9, flash: 0, walk: 0, speed: 0, recoil: 0, special: 5 + Math.random() * 3, summon: 9, mount: null,
  };
}
const BAND: Record<BotKind | "warden", [number, number]> = { guard: [6, 14], hound: [0, 0.8], drone: [5, 11], turret: [0, 99], shield: [3, 9], heavy: [10, 20], warden: [7, 16] };

const tmp = new THREE.Vector3();
export function muzzleOf(b: Bot) {
  const m = b.rig.muzzle, c = Math.cos(b.yaw), s = Math.sin(b.yaw);
  return tmp.set(b.x + m.x * c + m.z * s, b.y + m.y, b.z - m.x * s + m.z * c);
}

export function botThink(bw: BotWorld, b: Bot, dt: number, fire: (s: Shot) => void, summon: (b: Bot) => void) {
  const w = bw.w, spec = b.spec;
  if (b.spawnT > 0) { b.spawnT = Math.max(0, b.spawnT - dt); b.speed = 0; return; }
  const dx = bw.px - b.x, dz = bw.pz - b.z, dist = Math.hypot(dx, dz) || 1;
  const want = Math.atan2(dx, dz);
  b.yaw += clamp(angDiff(b.yaw, want), -dt * (b.kind === "warden" ? 1.6 : 5), dt * (b.kind === "warden" ? 1.6 : 5));
  // movement: keep the kind's distance, strafe; hounds rush in
  if (b.kind !== "turret") {
    const [near, far] = BAND[b.kind];
    let fwd = dist > far ? 1 : dist < near ? -0.6 : 0;
    if (spec.melee) fwd = dist > 1 ? 1 : 0;
    b.strafeT -= dt;
    if (b.strafeT <= 0) { b.strafeT = 1.2 + Math.random() * 2; if (Math.random() < 0.5) b.strafe = -b.strafe; }
    const side = spec.melee ? (b.stuck > 0.3 ? b.strafe : 0) : b.strafe * (b.stuck > 0.3 ? 1 : 0.5);
    const ux = dx / dist, uz = dz / dist;
    const sp = spec.speed * (1 + bw.d * 0.25) * (b.elite ? 1.15 : 1);
    let mx = (ux * fwd - uz * side) * sp, mz = (uz * fwd + ux * side) * sp;
    const ml = Math.hypot(mx, mz);
    if (ml > sp) { mx *= sp / ml; mz *= sp / ml; }
    if (spec.flying) {
      b.x += mx * dt; b.z += mz * dt;
      const floor = w.floorBelow(b.x, b.y + 0.4, b.z);
      const hover = Math.max(floor + 2.6, bw.py + 2.4) + Math.sin(bw.t * 1.4 + b.id) * 0.4;
      b.y += (hover - b.y) * Math.min(1, dt * 2);
      if (w.boxHits(b.x - 0.3, b.y, b.z - 0.3, b.x + 0.3, b.y + 0.5, b.z + 0.3)) b.y += 2 * dt * 4;
      const lim = w.nx * 0.25 - 1; b.x = clamp(b.x, -lim, lim); b.z = clamp(b.z, -lim, lim);
      b.speed = ml; b.grounded = false;
    } else {
      const moved = moveBody(w, b, mx * dt, mz * dt, true);
      if (!moved && fwd !== 0) { b.stuck += dt; if (b.stuck > 0.9 && b.grounded) { b.vy = 8.5; b.grounded = false; } }
      else b.stuck = Math.max(0, b.stuck - dt * 0.5);
      fallBody(w, b, dt, bw.g);
      unstick(w, b);
      b.speed = ml;
    }
  }
  if (!bw.pAlive) return;
  // the Warden: missile barrages and reinforcements
  if (b.kind === "warden") {
    b.special -= dt; b.summon -= dt;
    if (b.special <= 0) { b.special = 6 + Math.random() * 3; for (let k = 0; k < 5; k++) fire({ from: b, x: b.x, y: b.y + b.h * 0.9, z: b.z, tx: bw.px + (Math.random() - 0.5) * 5, ty: bw.py, tz: bw.pz + (Math.random() - 0.5) * 5, kind: "rocket" }); }
    if (b.summon <= 0) { b.summon = 10 + Math.random() * 4; summon(b); }
  }
  // attacking
  b.fireT -= dt;
  const m = muzzleOf(b), ty = bw.py + 1.0;
  b.pitch = Math.atan2(ty - m.y, dist);
  if (spec.melee) {
    if (dist < spec.range + 0.4 && Math.abs(bw.py - b.y) < 1.6 && b.fireT <= 0) { b.fireT = 1 / spec.rate; fire({ from: b, x: b.x, y: b.y, z: b.z, tx: bw.px, ty, tz: bw.pz, kind: "bolt" }); b.recoil = 1; }
    return;
  }
  if (dist > spec.range || b.fireT > 0) return;
  const facing = Math.abs(angDiff(b.yaw, want)) < 0.4;
  if (!facing || !w.clearLine(m.x, m.y, m.z, bw.px, ty, bw.pz, true)) { b.fireT = 0.3; return; }
  const wob = (0.03 + dist * 0.003) * (1.2 - bw.d * 0.5);
  fire({ from: b, x: m.x, y: m.y, z: m.z, tx: bw.px + (Math.random() - 0.5) * dist * wob, ty: ty + (Math.random() - 0.5) * dist * wob * 0.6, tz: bw.pz + (Math.random() - 0.5) * dist * wob, kind: b.kind === "heavy" ? "rocket" : b.kind === "warden" ? "cannon" : "bolt" });
  b.recoil = 1;
  b.burst = b.burst > 0 ? b.burst - 1 : spec.burst - 1;
  b.fireT = b.burst > 0 ? 0.12 : (1 / spec.rate) * (0.8 + Math.random() * 0.5) / (1 + bw.d * 0.4);
}

export function poseBot(b: Bot, dt: number, t: number) {
  const p = b.rig.parts;
  const moving = Math.min(1, b.speed / 3);
  b.walk += dt * (4 + b.speed * 1.5) * (moving > 0.05 ? 1 : 0);
  const sw = Math.sin(b.walk) * 0.7 * moving;
  b.rig.root.position.set(b.x, b.y, b.z);
  b.rig.pose.rotation.y = b.yaw;
  b.recoil = Math.max(0, b.recoil - dt * 8);
  const fl = Math.max(0, b.flash);
  b.rig.mat.emissive.setRGB(fl, fl, fl);
  b.flash = Math.max(0, b.flash - dt * 5);
  if (b.spawnT > 0) b.rig.root.scale.set(1 - b.spawnT * 0.9, 1 + b.spawnT * 1.5, 1 - b.spawnT * 0.9); else b.rig.root.scale.set(1, 1, 1);
  switch (b.kind) {
    case "drone": for (let i = 0; i < b.rig.extra.length; i++) b.rig.extra[i].rotation.y += dt * (30 + i); p.body.rotation.z = Math.sin(t * 2 + b.id) * 0.08; break;
    case "turret": p.head.rotation.x = -b.pitch; break;
    case "hound": {
      const legs = ["legL", "legR2", "legR", "legL2"];
      legs.forEach((n, i) => { p[n].rotation.x = Math.sin(b.walk * 1.4 + (i % 2) * Math.PI) * 0.6 * moving; });
      p.jaw.rotation.x = b.recoil * 0.5; p.body.position.y = 0.62 + Math.abs(Math.sin(b.walk * 1.4)) * 0.05 * moving;
      break;
    }
    default: {
      p.legL.rotation.x = sw; p.legR.rotation.x = -sw;
      p.armR.rotation.set(-Math.PI / 2 - b.pitch + b.recoil * 0.4, 0, 0);
      p.armL.rotation.set(b.kind === "shield" ? -1.2 : b.kind === "warden" ? -Math.PI / 2 - b.pitch : -sw * 0.6, 0, 0);
      p.head.rotation.y = Math.sin(t * 0.7 + b.id) * 0.15;
      if (b.kind === "warden") p.body.rotation.z = Math.sin(b.walk) * 0.05 * moving;
    }
  }
}
