// Everyone on the field: Ace (you), the two squad mates, the robots and the bosses. A unit is a body that moves on the
// block grid (it steps up half a block, jumps or flies over more, slides along walls), a rig that is posed every frame
// (walk cycles, aiming, recoil, rolling, rotors, jetpack flames, a white hit flash, a teleport-in shimmer), and for
// everyone but you a brain:
//  - robots pick the nearest of the squad (you first), keep their own distance (scouts close, snipers far), strafe
//    and duck behind blocks, fire bursts when they can see you (aim wobbles more far away; your movement throws them
//    off), snipers charge a beam you can see and dodge, spiders lob mortar shells, rollers rush in and blow up, drones
//    circle in the air, brutes plod forward firing an arm cannon; bosses add barrages, stomps and reinforcements;
//  - squad mates follow you in formation, pick their own targets, strafe and fire, and when they go down they get
//    back up a few seconds later.
import * as THREE from "three";
import { ROBOTS, type RobotSpec } from "./gear";
import type { BossKind, RobotKind } from "./worlds";
import { CELL_VOID, clearLine, floorUnder, kindAt, type Arena } from "./map";
import { humanRig, robotRig, type HumanLook, type Rig } from "./art/rigs";
import type { Outfit } from "./gear";
import { angDiff, clamp } from "./util";

export type UnitKind = HumanLook | RobotKind | BossKind | "tower";
export interface Unit {
  id: number; team: 0 | 1; kind: UnitKind;
  rig: Rig; spec: RobotSpec | null;
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  yaw: number; aimPitch: number;
  hp: number; maxHp: number; alive: boolean;
  /** squad mates: seconds until back on their feet */
  down: number;
  grounded: boolean; jetting: boolean;
  /** shooting: cooldown, shots left in a burst, a sniper's charge */
  fireT: number; burst: number; charge: number;
  target: Unit | null; thinkT: number; strafe: number; strafeT: number;
  walk: number; speed: number;
  flash: number; elite: boolean;
  /** teleporting in (robots), dropping in (the squad) */
  spawnT: number;
  shield: number;
  radius: number; height: number;
  /** a boss's special moves */
  special: number; summon: number;
  recoil: number;
  dead: number;
  /** seconds a robot has been walking into a wall (it hops, then teleports back in) */
  stuck: number;
}

let NEXT_ID = 1;
export function makeHuman(look: HumanLook, o: Outfit, x: number, z: number, y: number, hp: number): Unit {
  const rig = humanRig(look, o);
  return base(rig, 0, look, null, x, y, z, hp, 0.35, rig.height);
}
export function makeRobot(kind: RobotKind | BossKind | "tower", elite: boolean, x: number, z: number, y: number, hpScale: number): Unit {
  const spec = ROBOTS[kind];
  const rig = robotRig(kind, elite);
  const hp = spec.hp * hpScale * (elite ? 1.8 : 1);
  const u = base(rig, 1, kind, spec, x, y, z, hp, (spec.boss ? 1.4 : 0.42) * Math.max(0.8, spec.scale * (spec.boss ? 0.6 : 0.9)), rig.height);
  u.elite = elite;
  u.spawnT = 0.9;
  u.thinkT = Math.random() * 0.5;
  u.strafe = Math.random() < 0.5 ? 1 : -1;
  return u;
}
function base(rig: Rig, team: 0 | 1, kind: UnitKind, spec: RobotSpec | null, x: number, y: number, z: number, hp: number, radius: number, height: number): Unit {
  rig.root.position.set(x, y, z);
  return {
    id: NEXT_ID++, team, kind, rig, spec, x, y, z, vx: 0, vy: 0, vz: 0, yaw: 0, aimPitch: 0, hp, maxHp: hp, alive: true, down: 0,
    grounded: true, jetting: false, fireT: 1 + Math.random(), burst: 0, charge: 0, target: null, thinkT: 0, strafe: 1, strafeT: 0, walk: 0, speed: 0,
    flash: 0, elite: false, spawnT: 0, shield: 0, radius, height, special: 4 + Math.random() * 3, summon: 8, recoil: 0, dead: 0, stuck: 0,
  };
}

// ---------------------------------------------------------------- moving on the grid
const STEP = 0.55;
/** move a unit by (dx, dz), sliding along walls; it climbs half-block steps by itself */
export function walkTo(a: Arena, u: Unit, dx: number, dz: number, canClimb = STEP) {
  const r = u.radius * 0.8;
  const nx = u.x + dx, nz = u.z + dz;
  const okX = floorUnder(a, nx, u.z, r) <= u.y + canClimb;
  if (okX) u.x = nx;
  const okZ = floorUnder(a, u.x, nz, r) <= u.y + canClimb;
  if (okZ) u.z = nz;
  return okX && okZ;
}
/** gravity, landing, and the floor under the feet */
export function fall(a: Arena, u: Unit, dt: number, g: number) {
  const fl = floorUnder(a, u.x, u.z, u.radius * 0.8);
  if (u.y > fl + 0.02 || u.vy > 0) {
    u.vy -= g * dt; u.y += u.vy * dt; u.grounded = false;
    if (u.y <= fl) { const hit = -u.vy; u.y = fl; u.vy = 0; u.grounded = true; return hit; }
  } else {
    // stepping up onto a half block happens smoothly
    u.y += (fl - u.y) * Math.min(1, dt * 18); u.vy = 0; u.grounded = true;
  }
  return 0;
}
export function inVoid(a: Arena, u: Unit) { return u.y < -6 || (kindAt(a, u.x, u.z) === CELL_VOID && u.y < -2); }

// ---------------------------------------------------------------- posing
const _v = new THREE.Vector3();
export function pose(u: Unit, dt: number, t: number, aiming: boolean, cheer = false) {
  const p = u.rig.parts, k = u.kind;
  const moving = Math.min(1, u.speed / 4);
  u.walk += dt * (4 + u.speed * 1.6) * (moving > 0.05 ? 1 : 0);
  const sw = Math.sin(u.walk) * 0.7 * moving;
  u.rig.root.position.set(u.x, u.y, u.z);
  u.rig.pose.rotation.y = u.yaw;
  u.recoil = Math.max(0, u.recoil - dt * 8);
  // the white hit flash
  const fl = Math.max(0, u.flash);
  u.rig.mat.emissive.setRGB(fl, fl, fl);
  u.flash = Math.max(0, u.flash - dt * 5);
  if (k === "ace" || k === "juno" || k === "brick") {
    const air = !u.grounded;
    p.legL.rotation.x = air ? -0.35 : sw; p.legR.rotation.x = air ? 0.25 : -sw;
    p.body.position.y = 0.63 + Math.abs(Math.sin(u.walk)) * 0.04 * moving;
    p.head.rotation.x = -u.aimPitch * 0.5;
    if (u.down > 0) {
      u.rig.pose.rotation.x = -1.45; u.rig.pose.position.y = 0.2;
      p.armL.rotation.x = 0; p.armR.rotation.x = 0;
    } else {
      u.rig.pose.rotation.x = 0; u.rig.pose.position.y = 0;
      if (cheer) { p.armL.rotation.set(Math.PI - 0.3 + Math.sin(t * 9) * 0.15, 0, 0.2); p.armR.rotation.set(Math.PI - 0.5, 0, -0.2); }
      else if (aiming) {
        p.armR.rotation.set(-Math.PI / 2 - u.aimPitch + u.recoil * 0.4, 0, 0);
        p.armL.rotation.set(-Math.PI / 2 - u.aimPitch + 0.15 + u.recoil * 0.3, 0, -0.55);
      } else { p.armR.rotation.set(-0.5 - sw * 0.2, 0, 0); p.armL.rotation.set(sw * 0.8, 0, 0.05); }
    }
    if (u.rig.jet) { u.rig.jet.visible = u.jetting; if (u.jetting) u.rig.jet.scale.set(1, 0.8 + Math.random() * 0.6, 1); }
    return;
  }
  // robots
  const sc = u.spec!.scale;
  if (u.spawnT > 0) u.rig.root.scale.set(1 - u.spawnT * 0.9, 1 + u.spawnT * 1.5, 1 - u.spawnT * 0.9); else u.rig.root.scale.set(1, 1, 1);
  void sc;
  switch (k) {
    case "roller": {
      const ball = p.body.children[0];
      ball.rotation.x += u.speed * dt * 3.2;
      p.head.rotation.y = Math.sin(t * 4) * 0.4;
      break;
    }
    case "tower": {
      p.head.rotation.y += dt * 0.8;
      if (u.rig.extra[0]) u.rig.extra[0].rotation.y -= dt * 2.4;
      const s = 1 + Math.sin(t * 6 + u.id) * 0.04; p.head.scale.set(s, 1, s);
      break;
    }
    case "drone": case "carrier": {
      for (let i = 0; i < u.rig.extra.length; i++) u.rig.extra[i].rotation.y += dt * (30 + i);
      p.body.rotation.z = Math.sin(t * 2 + u.id) * 0.08 + u.vx * -0.02; p.body.rotation.x = Math.cos(t * 1.7 + u.id) * 0.06;
      break;
    }
    case "spider": {
      const legs = ["legL", "legR", "legL2", "legR2"];
      legs.forEach((n, i) => { const s = Math.sin(u.walk + i * Math.PI / 2) * 0.5 * moving; p[n].rotation.set(i < 2 ? 0.4 + s : -0.4 + s, 0, i % 2 ? -0.5 : 0.5); });
      p.body.position.y = 0.62 + Math.sin(u.walk * 2) * 0.03 * moving;
      break;
    }
    default: {
      if (p.legL) { p.legL.rotation.x = sw; p.legR.rotation.x = -sw; }
      const aim = u.target != null && u.spawnT <= 0;
      if (p.armR) p.armR.rotation.set(aim ? -Math.PI / 2 - u.aimPitch + u.recoil * 0.5 : -0.3 + sw * 0.3, 0, 0);
      if (p.armL) p.armL.rotation.set(aim && k !== "brute" && k !== "titan" ? -Math.PI / 2 + 0.2 : -sw * 0.6, 0, aim ? -0.4 : 0);
      if (p.head) p.head.rotation.y = Math.sin(t * 0.7 + u.id) * 0.15;
      if (k === "brute" || k === "titan") p.body.rotation.z = Math.sin(u.walk) * 0.05 * moving;
    }
  }
  if (!u.alive) { _v.set(0, 0, 0); }
}

// ---------------------------------------------------------------- robot brains
export interface Shot { from: Unit; x: number; y: number; z: number; tx: number; ty: number; tz: number; kind: "bolt" | "cannon" | "mortar" | "beam" | "missile" }
/** `goal`: a point robots head for (the core you defend, the relay you hold) instead of keeping their distance */
export interface World3 { arena: Arena; squad: Unit[]; player: Unit; diff: number; g: number; goal: { x: number; z: number } | null }

const tmp = { x: 0, y: 0, z: 0 };
/** a muzzle's world position */
export function muzzleOf(u: Unit, out = tmp) {
  const m = u.rig.muzzle, c = Math.cos(u.yaw), s = Math.sin(u.yaw);
  out.x = u.x + m.x * c + m.z * s; out.y = u.y + m.y; out.z = u.z - m.x * s + m.z * c;
  return out;
}
const DIST: Record<string, [number, number]> = { tower: [0, 999], scout: [7, 13], trooper: [9, 17], roller: [0, 0], drone: [9, 15], brute: [5, 12], sniper: [20, 32], spider: [13, 21], titan: [10, 20], carrier: [10, 18], overlord: [9, 18] };

export function robotThink(w: World3, u: Unit, dt: number, fire: (s: Shot) => void, explode: (u: Unit) => void, summon: (u: Unit, kind: RobotKind, n: number) => void) {
  const a = w.arena, spec = u.spec!;
  if (u.spawnT > 0) { u.spawnT = Math.max(0, u.spawnT - dt); u.speed = 0; return; }
  // pick a target now and then: the nearest of the squad (you count as nearer)
  u.thinkT -= dt;
  if (u.thinkT <= 0 || !u.target || !u.target.alive || u.target.down > 0) {
    u.thinkT = 0.5 + Math.random() * 0.4;
    let best: Unit | null = null, bd = 1e9;
    for (const s of w.squad) {
      if (!s.alive || s.down > 0 || s.spawnT > 0) continue;
      const d = Math.hypot(s.x - u.x, s.z - u.z) * (s === w.player ? 0.75 : 1);
      if (d < bd) { bd = d; best = s; }
    }
    u.target = best;
  }
  const t = u.target;
  if (!t) { u.speed = 0; return; }
  const dx = t.x - u.x, dz = t.z - u.z, dist = Math.hypot(dx, dz) || 1;
  const want = Math.atan2(dx, dz);
  u.yaw += clamp(angDiff(u.yaw, want), -dt * (spec.boss ? 1.5 : 4), dt * (spec.boss ? 1.5 : 4));
  // movement: hold the kind's distance band, strafe, back off when too close — or, for one walking robot in three
  // when there's a goal (the core, a relay), rush it
  const [near, far] = DIST[u.kind] ?? [8, 16];
  const goal = w.goal && u.id % 3 === 0 && !spec.boss && !spec.kamikaze && !spec.flying ? w.goal : null;
  const gx = goal ? goal.x - u.x : dx, gz = goal ? goal.z - u.z : dz, gd = Math.hypot(gx, gz) || 1;
  let fwd = 0;
  if (goal) fwd = gd > 2.4 ? 1 : 0;
  else if (spec.kamikaze) fwd = 1;
  else if (dist > far) fwd = 1; else if (dist < near) fwd = -0.7;
  u.strafeT -= dt;
  if (u.strafeT <= 0) { u.strafeT = 1.2 + Math.random() * 2; if (Math.random() < 0.5) u.strafe = -u.strafe; }
  const side = spec.kamikaze ? (u.stuck > 0.3 ? u.strafe * 0.9 : 0) : u.strafe * (u.stuck > 0.3 ? 0.9 : goal ? 0.25 : dist < far + 4 ? 0.6 : 0.15);
  const ux = gx / gd, uz = gz / gd;
  const sp = spec.speed * (1 + w.diff * 0.2) * (u.elite ? 1.15 : 1);
  let mx = (ux * fwd + -uz * side) * sp, mz = (uz * fwd + ux * side) * sp;
  const ml = Math.hypot(mx, mz);
  if (ml > sp) { mx *= sp / ml; mz *= sp / ml; }
  if (spec.flying) {
    // drones and the carrier fly: a hover height above the ground, a gentle bob
    u.x += mx * dt; u.z += mz * dt;
    const lim = a.half - 2.5; u.x = clamp(u.x, -lim, lim); u.z = clamp(u.z, -lim, lim);
    const hover = (spec.boss ? 8 : 4.5) + Math.sin(performance.now() / 700 + u.id) * 0.6;
    const fl = floorUnder(a, u.x, u.z, u.radius);
    u.y += (Math.max(fl + 1.5, hover + Math.max(0, fl)) - u.y) * Math.min(1, dt * 2);
    u.speed = ml; u.grounded = false;
  } else if (sp > 0) {
    const moved = walkTo(a, u, mx * dt, mz * dt, spec.boss ? 1.6 : 1.05);
    // walking into a wall: slide sideways, then hop it; the game teleports a robot stuck for long back in
    if (!moved && fwd !== 0) { u.stuck += dt; if (u.strafeT > 0.8) { u.strafe = -u.strafe; u.strafeT = 0.8; } if (u.stuck > 1.1 && u.grounded) { u.vy = 9.5; u.grounded = false; } }
    else u.stuck = Math.max(0, u.stuck - dt * 0.5);
    u.speed = ml;
    fall(a, u, dt, w.g);
  }
  // a roller blows up beside you
  if (spec.kamikaze) { if (dist < spec.range + t.radius && Math.abs(t.y - u.y) < 2) explode(u); return; }
  // beacons call robots in
  if (spec.spawner) { u.summon -= dt; if (u.summon <= 0) { u.summon = Math.max(4, 9 - w.diff * 4) + Math.random() * 3; summon(u, "scout", Math.random() < w.diff ? 2 : 1); } }
  // bosses: barrages, stomps, reinforcements
  if (spec.boss) {
    u.special -= dt; u.summon -= dt;
    if (u.special <= 0) {
      u.special = 6 + Math.random() * 3;
      if (u.kind === "titan" || u.kind === "overlord") for (let k = 0; k < 6; k++) fire({ from: u, x: u.x, y: u.y + u.height * 0.8, z: u.z, tx: t.x + (Math.random() - 0.5) * 6, ty: t.y, tz: t.z + (Math.random() - 0.5) * 6, kind: "missile" });
      if (u.kind === "carrier") for (let k = 0; k < 8; k++) fire({ from: u, x: u.x, y: u.y, z: u.z, tx: t.x + Math.cos(k) * 4, ty: t.y, tz: t.z + Math.sin(k) * 4, kind: "mortar" });
    }
    if (u.summon <= 0) { u.summon = 9 + Math.random() * 4; summon(u, u.kind === "carrier" ? "drone" : u.kind === "overlord" ? "trooper" : "scout", u.kind === "carrier" ? 2 : 2); }
  }
  // shooting
  const m = muzzleOf(u);
  const ty = t.y + t.height * 0.55;
  u.aimPitch = Math.atan2(ty - m.y, dist);
  u.fireT -= dt;
  if (dist > spec.range) { u.charge = 0; return; }
  const facing = Math.abs(angDiff(u.yaw, want)) < 0.35;
  if (spec.beam) {
    // the sniper charges a beam (you can see it coming), then fires if it still sees you
    if (u.charge > 0) {
      u.charge += dt;
      if (u.charge > 1.15) { u.charge = 0; u.fireT = 1 / spec.rate; if (clearLine(a, m.x, m.y, m.z, t.x, ty, t.z)) fire({ from: u, x: m.x, y: m.y, z: m.z, tx: t.x, ty, tz: t.z, kind: "beam" }); }
    } else if (u.fireT <= 0 && facing && clearLine(a, m.x, m.y, m.z, t.x, ty, t.z)) u.charge = 0.001;
    return;
  }
  if (u.fireT > 0) return;
  if (!facing || !clearLine(a, m.x, m.y, m.z, t.x, ty, t.z)) { u.fireT = 0.25; return; }
  if (spec.mortar) { fire({ from: u, x: m.x, y: m.y, z: m.z, tx: t.x + t.vx * 0.6, ty: t.y, tz: t.z + t.vz * 0.6, kind: "mortar" }); u.fireT = 1 / spec.rate * (0.8 + Math.random() * 0.4); return; }
  // a burst
  const wobble = (0.035 + dist * 0.0028) * (1.25 - w.diff * 0.5);
  fire({ from: u, x: m.x, y: m.y, z: m.z, tx: t.x + (Math.random() - 0.5) * dist * wobble, ty: ty + (Math.random() - 0.5) * dist * wobble * 0.6, tz: t.z + (Math.random() - 0.5) * dist * wobble, kind: u.kind === "brute" || u.kind === "titan" ? "cannon" : "bolt" });
  u.recoil = 1;
  u.burst = u.burst > 0 ? u.burst - 1 : spec.burst - 1;
  u.fireT = u.burst > 0 ? 0.13 : (1 / spec.rate) * (0.8 + Math.random() * 0.5) / (1 + w.diff * 0.45);
}

// ---------------------------------------------------------------- squad mates
export function allyThink(w: World3, u: Unit, slot: number, dt: number, robots: Unit[], fire: (s: Shot) => void) {
  const a = w.arena, p = w.player;
  if (u.down > 0) { u.speed = 0; return; }
  u.thinkT -= dt;
  if (u.thinkT <= 0 || (u.target && (!u.target.alive || u.target.spawnT > 0))) {
    u.thinkT = 0.6 + Math.random() * 0.4;
    let best: Unit | null = null, bd = 34;
    for (const r of robots) { if (!r.alive || r.spawnT > 0) continue; const d = Math.hypot(r.x - u.x, r.z - u.z); if (d < bd && clearLine(a, u.x, u.y + 1.4, u.z, r.x, r.y + r.height * 0.5, r.z)) { bd = d; best = r; } }
    u.target = best;
  }
  // stay in formation near Ace: back left / back right, a bit wider in a fight
  const side = slot === 0 ? 1 : -1, back = u.target ? 1.5 : 3;
  const fx = p.x + Math.cos(p.yaw) * side * 3 - Math.sin(p.yaw) * back, fz = p.z - Math.sin(p.yaw) * side * 3 - Math.cos(p.yaw) * back;
  let dx = fx - u.x, dz = fz - u.z;
  const d = Math.hypot(dx, dz);
  const sp = d > 8 ? 7.5 : d > 1.5 ? 5 : 0;
  if (u.target) { u.strafeT -= dt; if (u.strafeT <= 0) { u.strafeT = 1 + Math.random() * 1.5; u.strafe = -u.strafe; } dx += Math.cos(u.yaw) * u.strafe * 2; dz -= Math.sin(u.yaw) * u.strafe * 2; }
  const dl = Math.hypot(dx, dz) || 1;
  if (sp > 0 || u.target) { const s = sp || 2; walkTo(a, u, (dx / dl) * s * dt, (dz / dl) * s * dt, 0.55); u.speed = s; } else u.speed = 0;
  // squad mates hop up onto ledges to keep up
  if (u.grounded && floorUnder(a, u.x + (dx / dl) * 0.6, u.z + (dz / dl) * 0.6, 0.3) > u.y + 0.55 && sp > 0) u.vy = 8.5;
  fall(a, u, dt, w.g);
  if (d > 30 || inVoid(a, u)) { u.x = p.x - Math.sin(p.yaw) * 2 + side; u.z = p.z - Math.cos(p.yaw) * 2; u.y = p.y + 0.5; u.vy = 0; }
  const t = u.target;
  if (t) {
    const want = Math.atan2(t.x - u.x, t.z - u.z);
    u.yaw += clamp(angDiff(u.yaw, want), -dt * 6, dt * 6);
    const m = muzzleOf(u), ty = t.y + t.height * 0.5, dist = Math.hypot(t.x - u.x, t.z - u.z);
    u.aimPitch = Math.atan2(ty - m.y, dist);
    u.fireT -= dt;
    if (u.fireT <= 0 && Math.abs(angDiff(u.yaw, want)) < 0.3) {
      const wob = 0.04 + dist * 0.003;
      fire({ from: u, x: m.x, y: m.y, z: m.z, tx: t.x + (Math.random() - 0.5) * dist * wob, ty: ty + (Math.random() - 0.5) * dist * wob, tz: t.z + (Math.random() - 0.5) * dist * wob, kind: "bolt" });
      u.recoil = 1;
      u.fireT = u.kind === "brick" ? 0.32 : 0.22;
    }
  } else {
    u.yaw += clamp(angDiff(u.yaw, p.yaw), -dt * 4, dt * 4);
    u.aimPitch *= 0.9;
  }
}
