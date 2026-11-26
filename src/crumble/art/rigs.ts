// The crew, Baron Bolt's security robots, the van, the tools and the loot — all built from coloured voxels and merged,
// each part one mesh so it can swing:
//  - Rocco, a raccoon in an orange hoodie and jeans with a tool belt, a black bandit mask over bright eyes, a white
//    muzzle, round ears and a ringed tail; Pip, a fox in a cap with a radio headset, at the van's wheel;
//  - Bolt Security: the guard (navy armour, a red visor, a blaster arm), the hound (a robot dog with a snapping jaw),
//    the drone (four rotors and a gun pod), the turret (a wall mount with twin barrels), the riot bot (a tall plate
//    shield), the heavy (a rocket pod on its shoulder) and the Vault Warden (a big gold-trimmed mech with two cannons);
//  - the getaway van: teal with an orange stripe, a ladder on the roof rack, headlights and wheels that turn;
//  - the tools in your hands: the Crumble Mallet, the blaster, the drill, the boom ball (grenade), dynamite, the
//    rocket tube and the paint sprayer;
//  - the loot and pickups: cash stacks, gold bars, gems, framed art, coins, hearts, oil cans, power cubes, ammo crates.
import * as THREE from "three";
import { Builder, C } from "./voxel";
import type { BotKind } from "../districts";

type B = [number, number, number, number, number, number, number | string];
const cache = new Map<string, THREE.BufferGeometry>();
/** a merged part from boxes [cx, cy, cz, sx, sy, sz, colour] */
export function part(key: string, boxes: B[], shade = true) {
  const hit = cache.get(key);
  if (hit) return hit;
  const b = new Builder();
  for (const [x, y, z, sx, sy, sz, c] of boxes) b.box(x, y, z, sx, sy, sz, C(c), undefined, undefined, shade);
  const g = b.geometry();
  cache.set(key, g);
  return g;
}
export const rigMat = () => new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
export const sharedMat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });

export interface Rig { root: THREE.Group; pose: THREE.Group; parts: Record<string, THREE.Object3D>; mat: THREE.MeshLambertMaterial; height: number; muzzle: THREE.Vector3; extra: THREE.Object3D[] }
function mount(mat: THREE.MeshLambertMaterial, defs: [string, THREE.BufferGeometry, number, number, number, string?][]): Rig {
  const root = new THREE.Group(), pose = new THREE.Group();
  root.add(pose);
  const parts: Record<string, THREE.Object3D> = {};
  for (const [name, geo, x, y, z, parent] of defs) {
    const holder = new THREE.Group();
    const m = new THREE.Mesh(geo, mat); m.castShadow = true;
    holder.add(m); holder.position.set(x, y, z);
    parts[name] = holder;
    (parent ? parts[parent] : pose).add(holder);
  }
  return { root, pose, parts, mat, height: 1.6, muzzle: new THREE.Vector3(), extra: [] };
}

// ---------------------------------------------------------------- the crew
const FUR = "#8A8E9A", FUR_D = "#5A5E6A", MASK = "#1E1E26", WHITE = "#F2F2EA", HOOD = "#FF8A3A", HOOD_D = "#D8682A", JEANS = "#3A5A9A";
export function roccoRig(hoodie = HOOD) {
  const hd = hoodie, hdd = shadeHex(hoodie, -0.18);
  const mat = rigMat();
  const r = mount(mat, [
    ["body", part(`r-body-${hd}`, [[0, 0.28, 0, 0.5, 0.56, 0.3, hd], [0, 0.04, 0, 0.52, 0.1, 0.32, "#6A4426"], [0, 0.04, 0.165, 0.1, 0.08, 0.02, "#E8B030"], [0, 0.22, 0.155, 0.3, 0.14, 0.02, hdd], [0, 0.52, -0.12, 0.42, 0.14, 0.1, hdd], [0.27, 0.06, 0.06, 0.06, 0.12, 0.08, "#8A92A6"], [-0.27, 0.06, 0.06, 0.06, 0.12, 0.08, "#E8B030"]]), 0, 0.62, 0],
    ["head", part("r-head", [
      [0, 0.24, 0, 0.56, 0.46, 0.5, FUR], [0, 0.29, 0.255, 0.58, 0.12, 0.02, MASK], [-0.13, 0.29, 0.268, 0.08, 0.06, 0.01, WHITE], [0.13, 0.29, 0.268, 0.08, 0.06, 0.01, WHITE],
      [-0.12, 0.29, 0.272, 0.04, 0.04, 0.01, "#1A1A22"], [0.14, 0.29, 0.272, 0.04, 0.04, 0.01, "#1A1A22"], [0, 0.14, 0.3, 0.24, 0.14, 0.12, WHITE], [0, 0.18, 0.365, 0.08, 0.06, 0.03, MASK],
      [-0.2, 0.52, 0, 0.14, 0.14, 0.1, FUR_D], [0.2, 0.52, 0, 0.14, 0.14, 0.1, FUR_D], [-0.2, 0.52, 0.04, 0.07, 0.08, 0.04, "#E8A0A8"], [0.2, 0.52, 0.04, 0.07, 0.08, 0.04, "#E8A0A8"],
      [0, 0.45, -0.05, 0.6, 0.08, 0.56, hd], [0, 0.04, 0.2, 0.36, 0.04, 0.12, WHITE],
    ]), 0, 0.56, 0, "body"],
    ["armL", part(`r-arm-${hd}`, [[0, -0.2, 0, 0.15, 0.42, 0.16, hd], [0, -0.44, 0.01, 0.14, 0.1, 0.14, FUR_D]]), 0.33, 0.52, 0, "body"],
    ["armR", part(`r-arm-${hd}`, [[0, -0.2, 0, 0.15, 0.42, 0.16, hd], [0, -0.44, 0.01, 0.14, 0.1, 0.14, FUR_D]]), -0.33, 0.52, 0, "body"],
    ["legL", part("r-leg", [[0, -0.24, 0, 0.19, 0.48, 0.2, JEANS], [0, -0.55, 0.04, 0.2, 0.1, 0.27, "#2A2A32"]]), 0.12, 0.62, 0],
    ["legR", part("r-leg", [[0, -0.24, 0, 0.19, 0.48, 0.2, JEANS], [0, -0.55, 0.04, 0.2, 0.1, 0.27, "#2A2A32"]]), -0.12, 0.62, 0],
    ["tail", part("r-tail", [[0, 0, -0.08, 0.16, 0.16, 0.16, FUR], [0, 0.06, -0.22, 0.17, 0.17, 0.14, MASK], [0, 0.14, -0.34, 0.17, 0.17, 0.14, FUR], [0, 0.24, -0.44, 0.16, 0.16, 0.14, MASK], [0, 0.35, -0.5, 0.15, 0.15, 0.12, FUR]]), 0, 0.68, -0.15],
  ]);
  r.height = 1.75; r.muzzle.set(-0.33, 1.05, 0.5);
  void HOOD_D;
  return r;
}
export function pipRig() {
  const mat = rigMat(), OR = "#F07A2A";
  return mount(mat, [
    ["body", part("p-body", [[0, 0.25, 0, 0.5, 0.5, 0.3, "#3A6AA8"], [0, 0.25, 0.16, 0.2, 0.3, 0.02, "#F2F2EA"]]), 0, 0, 0],
    ["head", part("p-head", [
      [0, 0.22, 0, 0.5, 0.42, 0.46, OR], [0, 0.12, 0.27, 0.26, 0.14, 0.14, "#F2F2EA"], [0, 0.17, 0.35, 0.08, 0.06, 0.03, "#1E1E26"], [-0.12, 0.28, 0.235, 0.07, 0.07, 0.01, "#1E1E26"], [0.12, 0.28, 0.235, 0.07, 0.07, 0.01, "#1E1E26"],
      [-0.18, 0.5, 0, 0.12, 0.16, 0.1, OR], [0.18, 0.5, 0, 0.12, 0.16, 0.1, OR], [0, 0.46, 0.02, 0.54, 0.1, 0.5, "#2AC8D8"], [0, 0.44, 0.28, 0.4, 0.04, 0.12, "#2AC8D8"],
      [-0.27, 0.24, 0, 0.04, 0.16, 0.16, "#2A2D3A"], [-0.24, 0.12, 0.18, 0.03, 0.03, 0.16, "#2A2D3A"],
    ]), 0, 0.5, 0, "body"],
  ]);
}

// ---------------------------------------------------------------- Bolt Security
const NAVY = "#2A3A6A", NAVY_D = "#1A2448", STEEL_C = "#8A92A6", DARK = "#2A2D3A", VISOR = "#FF3A3A", YEL = "#FFD23F";
export function botRig(kind: BotKind | "warden", elite: boolean): Rig {
  const mat = rigMat();
  const arm = elite ? "#C8A040" : NAVY, body = elite ? "#E8B830" : NAVY;
  let r: Rig;
  switch (kind) {
    case "guard": case "shield": case "heavy": {
      const big = kind === "heavy" ? 1.25 : kind === "shield" ? 1.12 : 1;
      r = mount(mat, [
        ["body", part(`g-body-${kind}-${elite}`, [[0, 0.3 * big, 0, 0.56 * big, 0.6 * big, 0.36 * big, body], [0, 0.42 * big, 0.19 * big, 0.36 * big, 0.12 * big, 0.02, YEL], [0, 0.02, 0, 0.5 * big, 0.08, 0.32 * big, DARK], [0, 0.3 * big, 0.19 * big, 0.08, 0.08, 0.02, VISOR]]), 0, 0.66 * big, 0],
        ["head", part(`g-head-${big}`, [[0, 0.2 * big, 0, 0.42 * big, 0.38 * big, 0.4 * big, STEEL_C], [0, 0.22 * big, 0.21 * big, 0.36 * big, 0.1 * big, 0.02, VISOR], [0, 0.42 * big, 0, 0.06, 0.14, 0.06, DARK], [0, 0.5 * big, 0, 0.08, 0.06, 0.08, VISOR]]), 0, 0.6 * big, 0, "body"],
        ["armL", part(`g-arm-${big}-${elite}`, [[0, -0.22 * big, 0, 0.16 * big, 0.46 * big, 0.18 * big, arm], [0, -0.48 * big, 0, 0.18 * big, 0.12, 0.2 * big, DARK]]), 0.38 * big, 0.56 * big, 0, "body"],
        ["armR", part(`g-armR-${big}-${elite}`, [[0, -0.22 * big, 0, 0.16 * big, 0.46 * big, 0.18 * big, arm], [0, -0.5 * big, 0.18, 0.12, 0.12, 0.42, DARK], [0, -0.5 * big, 0.4, 0.06, 0.06, 0.04, VISOR]]), -0.38 * big, 0.56 * big, 0, "body"],
        ["legL", part(`g-leg-${big}`, [[0, -0.3 * big, 0, 0.2 * big, 0.6 * big, 0.22 * big, DARK], [0, -0.62 * big, 0.04, 0.22 * big, 0.08, 0.3 * big, STEEL_C]]), 0.14 * big, 0.66 * big, 0],
        ["legR", part(`g-leg-${big}`, [[0, -0.3 * big, 0, 0.2 * big, 0.6 * big, 0.22 * big, DARK], [0, -0.62 * big, 0.04, 0.22 * big, 0.08, 0.3 * big, STEEL_C]]), -0.14 * big, 0.66 * big, 0],
      ]);
      if (kind === "shield") { const s = new THREE.Mesh(part("g-shield", [[0, 0, 0, 0.9, 1.3, 0.08, "#5A6A8A"], [0, 0.3, 0.05, 0.6, 0.16, 0.02, "#9AF0FF"], [0, -0.1, 0.05, 0.5, 0.06, 0.02, YEL]]), mat); s.position.set(0.05, -0.35, 0.32); r.parts.armL.add(s); r.extra.push(s); }
      if (kind === "heavy") { const s = new THREE.Mesh(part("g-pod", [[0, 0, 0, 0.42, 0.34, 0.5, DARK], [-0.1, 0.06, 0.26, 0.12, 0.12, 0.02, VISOR], [0.1, 0.06, 0.26, 0.12, 0.12, 0.02, VISOR], [-0.1, -0.08, 0.26, 0.12, 0.12, 0.02, VISOR], [0.1, -0.08, 0.26, 0.12, 0.12, 0.02, VISOR]]), mat); s.position.set(-0.3, 0.72, 0); r.parts.body.add(s); r.extra.push(s); }
      r.height = 1.7 * big; r.muzzle.set(-0.38 * big, 1.0 * big, 0.62);
      break;
    }
    case "hound": {
      r = mount(mat, [
        ["body", part(`h-body-${elite}`, [[0, 0, 0, 0.42, 0.34, 0.9, body], [0, 0.18, 0, 0.3, 0.04, 0.6, YEL], [0, 0.1, -0.55, 0.06, 0.06, 0.3, STEEL_C], [0, 0.18, -0.68, 0.08, 0.08, 0.08, VISOR]]), 0, 0.62, 0],
        ["head", part("h-head", [[0, 0.08, 0.16, 0.36, 0.3, 0.36, STEEL_C], [0, 0.06, 0.38, 0.28, 0.14, 0.14, DARK], [-0.1, 0.16, 0.345, 0.08, 0.05, 0.02, VISOR], [0.1, 0.16, 0.345, 0.08, 0.05, 0.02, VISOR], [-0.13, 0.28, 0.1, 0.08, 0.14, 0.06, DARK], [0.13, 0.28, 0.1, 0.08, 0.14, 0.06, DARK]]), 0, 0.12, 0.45, "body"],
        ["jaw", part("h-jaw", [[0, -0.04, 0.16, 0.24, 0.06, 0.24, DARK]]), 0, -0.02, 0.24, "head"],
        ["legL", part("h-leg", [[0, -0.22, 0, 0.12, 0.44, 0.12, DARK]]), 0.17, 0.5, 0.32],
        ["legR", part("h-leg", [[0, -0.22, 0, 0.12, 0.44, 0.12, DARK]]), -0.17, 0.5, 0.32],
        ["legL2", part("h-leg", [[0, -0.22, 0, 0.12, 0.44, 0.12, DARK]]), 0.17, 0.5, -0.32],
        ["legR2", part("h-leg", [[0, -0.22, 0, 0.12, 0.44, 0.12, DARK]]), -0.17, 0.5, -0.32],
      ]);
      r.height = 0.95; r.muzzle.set(0, 0.7, 0.8);
      break;
    }
    case "drone": {
      r = mount(mat, [
        ["body", part(`d-body-${elite}`, [[0, 0, 0, 0.6, 0.22, 0.6, body], [0, -0.16, 0.1, 0.24, 0.14, 0.3, DARK], [0, -0.16, 0.27, 0.1, 0.06, 0.06, VISOR], [0, 0.13, 0, 0.3, 0.06, 0.3, YEL]]), 0, 0, 0],
        ["head", part("d-eye", [[0, 0, 0.31, 0.2, 0.1, 0.02, VISOR]]), 0, 0, 0, "body"],
      ]);
      for (const [x, z] of [[0.42, 0.42], [-0.42, 0.42], [0.42, -0.42], [-0.42, -0.42]]) {
        const arm = new THREE.Mesh(part("d-arm", [[0, 0, 0, 0.1, 0.06, 0.1, DARK], [0, 0.07, 0, 0.04, 0.1, 0.04, STEEL_C]]), mat); arm.position.set(x, 0, z); r.parts.body.add(arm);
        const rot = new THREE.Mesh(part("d-rotor", [[0, 0, 0, 0.56, 0.02, 0.07, DARK], [0, 0, 0, 0.07, 0.02, 0.56, DARK]]), mat); rot.position.set(x, 0.13, z); r.parts.body.add(rot); r.extra.push(rot);
      }
      r.height = 0.5; r.muzzle.set(0, -0.16, 0.36);
      break;
    }
    case "turret": {
      r = mount(mat, [
        ["body", part("t-base", [[0, 0, -0.18, 0.6, 0.6, 0.2, DARK], [0, 0, 0, 0.34, 0.3, 0.3, STEEL_C], [0, 0.25, -0.18, 0.5, 0.06, 0.04, YEL]]), 0, 0, 0],
        ["head", part(`t-head-${elite}`, [[0, 0, 0.18, 0.46, 0.32, 0.4, body], [-0.1, 0, 0.5, 0.08, 0.08, 0.34, DARK], [0.1, 0, 0.5, 0.08, 0.08, 0.34, DARK], [0, 0.08, 0.39, 0.22, 0.06, 0.02, VISOR]]), 0, 0, 0.12, "body"],
      ]);
      r.height = 0.6; r.muzzle.set(0, 0, 0.75);
      break;
    }
    case "warden": {
      const s = 2.6;
      r = mount(mat, [
        ["body", part("w-body", [[0, 0.3 * s, 0, 0.7 * s, 0.6 * s, 0.46 * s, "#3A3E4E"], [0, 0.46 * s, 0.24 * s, 0.5 * s, 0.12 * s, 0.02, "#E8B030"], [0, 0.26 * s, 0.24 * s, 0.24 * s, 0.18 * s, 0.03, "#FF3A3A"], [0, 0.03, 0, 0.6 * s, 0.1, 0.4 * s, DARK]]), 0, 0.7 * s, 0],
        ["head", part("w-head", [[0, 0.16 * s, 0, 0.42 * s, 0.3 * s, 0.4 * s, "#5A6070"], [0, 0.18 * s, 0.21 * s, 0.34 * s, 0.08 * s, 0.02, "#FF3A3A"], [0, 0.34 * s, 0, 0.5 * s, 0.06 * s, 0.46 * s, "#E8B030"], [-0.18 * s, 0.42 * s, 0, 0.06 * s, 0.1 * s, 0.06 * s, "#E8B030"], [0.18 * s, 0.42 * s, 0, 0.06 * s, 0.1 * s, 0.06 * s, "#E8B030"], [0, 0.44 * s, 0, 0.06 * s, 0.14 * s, 0.06 * s, "#E8B030"]]), 0, 0.6 * s, 0, "body"],
        ["armL", part("w-arm", [[0, -0.2 * s, 0, 0.24 * s, 0.44 * s, 0.26 * s, "#4A5060"], [0, -0.46 * s, 0.22 * s, 0.22 * s, 0.22 * s, 0.6 * s, DARK], [0, -0.46 * s, 0.53 * s, 0.14 * s, 0.14 * s, 0.03, "#FF8A2A"]]), 0.52 * s, 0.56 * s, 0, "body"],
        ["armR", part("w-arm", [[0, -0.2 * s, 0, 0.24 * s, 0.44 * s, 0.26 * s, "#4A5060"], [0, -0.46 * s, 0.22 * s, 0.22 * s, 0.22 * s, 0.6 * s, DARK], [0, -0.46 * s, 0.53 * s, 0.14 * s, 0.14 * s, 0.03, "#FF8A2A"]]), -0.52 * s, 0.56 * s, 0, "body"],
        ["legL", part("w-leg", [[0, -0.32 * s, 0, 0.26 * s, 0.64 * s, 0.3 * s, DARK], [0, -0.66 * s, 0.06 * s, 0.32 * s, 0.1 * s, 0.42 * s, "#5A6070"]]), 0.2 * s, 0.7 * s, 0],
        ["legR", part("w-leg", [[0, -0.32 * s, 0, 0.26 * s, 0.64 * s, 0.3 * s, DARK], [0, -0.66 * s, 0.06 * s, 0.32 * s, 0.1 * s, 0.42 * s, "#5A6070"]]), -0.2 * s, 0.7 * s, 0],
      ]);
      r.height = 1.75 * s; r.muzzle.set(0.52 * s, 0.6 * s, 1.5 * s);
      break;
    }
  }
  void NAVY_D;
  return r!;
}

// ---------------------------------------------------------------- the van
export function vanRig() {
  const mat = rigMat(), T = "#2AB8B0", T2 = "#1A8A8A", O = "#FF8A3A";
  const r = mount(mat, [
    ["body", part("v-body", [
      [0, 1.15, 0, 2.2, 1.7, 4.8, T], [0, 0.55, 0, 2.24, 0.3, 4.84, O], [0, 2.02, -0.4, 2.0, 0.08, 3.4, T2],
      [0, 1.55, 2.41, 1.9, 0.8, 0.02, "#9AD8F8"], [1.11, 1.55, 1.7, 0.02, 0.7, 1.0, "#9AD8F8"], [-1.11, 1.55, 1.7, 0.02, 0.7, 1.0, "#9AD8F8"],
      [0.75, 0.9, 2.41, 0.4, 0.22, 0.03, "#FFF6C0"], [-0.75, 0.9, 2.41, 0.4, 0.22, 0.03, "#FFF6C0"], [0, 0.55, 2.43, 2.0, 0.2, 0.04, "#8A92A6"],
      [0.75, 0.9, -2.41, 0.36, 0.2, 0.03, "#FF3A3A"], [-0.75, 0.9, -2.41, 0.36, 0.2, 0.03, "#FF3A3A"], [0, 1.2, -2.41, 0.04, 1.2, 0.03, T2],
      [1.115, 1.15, -0.6, 0.02, 0.9, 2.2, "#F2F2EA"], [1.12, 1.15, -0.6, 0.02, 0.5, 1.6, O], [-1.115, 1.15, -0.6, 0.02, 0.9, 2.2, "#F2F2EA"], [-1.12, 1.15, -0.6, 0.02, 0.5, 1.6, O],
      [0.6, 2.2, -0.4, 0.08, 0.1, 3.2, "#8A92A6"], [-0.6, 2.2, -0.4, 0.08, 0.1, 3.2, "#8A92A6"], [0, 2.26, -1.6, 1.3, 0.06, 0.1, "#8A92A6"], [0, 2.26, 0.8, 1.3, 0.06, 0.1, "#8A92A6"],
      [0.3, 2.32, -0.4, 0.08, 0.08, 3.0, "#C8C8D0"], [-0.3, 2.32, -0.4, 0.08, 0.08, 3.0, "#C8C8D0"],
    ]), 0, 0, 0],
  ]);
  const wheelGeo = part("v-wheel", [[0, 0, 0, 0.3, 0.8, 0.8, "#1E1E26"], [0, 0, 0, 0.32, 0.4, 0.4, "#8A92A6"]]);
  for (const [x, z] of [[1.0, 1.55], [-1.0, 1.55], [1.0, -1.55], [-1.0, -1.55]]) { const m = new THREE.Mesh(wheelGeo, mat); m.position.set(x, 0.4, z); r.pose.add(m); r.extra.push(m); }
  const pip = pipRig(); pip.root.position.set(0.5, 0.95, 1.5); pip.root.scale.setScalar(0.85); r.pose.add(pip.root);
  r.parts.pip = pip.root; r.parts.pipHead = pip.parts.head;
  r.height = 2.3;
  return r;
}

// ---------------------------------------------------------------- tools (held in first person, and in Rocco's paw)
export type ToolId = "hammer" | "drill" | "paint" | "blaster" | "smg" | "scatter" | "rocket" | "laser" | "plasma" | "minigun" | "swarm" | "omega" | "wrecker" | "storm";
/** what a thrown bomb looks like (its colour) */
export function bombGeometry(color: string, big = false) {
  const s = big ? 1.6 : 1;
  return part(`bomb-${color}-${big}`, [[0, 0, 0, 0.2 * s, 0.2 * s, 0.2 * s, color], [0, 0.12 * s, 0, 0.08 * s, 0.05 * s, 0.08 * s, "#2A2D3A"], [0.04 * s, 0.16 * s, 0, 0.1 * s, 0.02 * s, 0.03 * s, "#F2F2EA"], [0, 0, 0.102 * s, 0.1 * s, 0.03 * s, 0.01, "#FFFFFF"]]);
}
/** three red sticks taped together, with a fuse */
export const dynamiteGeometry = () => part("bomb-dynamite", [[-0.07, 0, 0, 0.07, 0.3, 0.07, "#D8302A"], [0, 0, 0.02, 0.07, 0.3, 0.07, "#E8443A"], [0.07, 0, 0, 0.07, 0.3, 0.07, "#D8302A"], [0, 0.04, 0, 0.22, 0.04, 0.1, "#F2F2EA"], [0, -0.08, 0, 0.22, 0.04, 0.1, "#F2F2EA"], [0, 0.19, 0, 0.02, 0.08, 0.02, "#2A2D3A"]]);
export function toolGeometry(id: ToolId) {
  switch (id) {
    case "hammer": return part("tool-hammer", [[0, -0.05, 0, 0.06, 0.7, 0.06, "#FF8A3A"], [0, -0.2, 0, 0.07, 0.06, 0.07, "#2A2D3A"], [0, -0.38, 0, 0.07, 0.04, 0.07, "#2A2D3A"], [0, 0.32, 0, 0.36, 0.2, 0.2, "#8A92A6"], [0.19, 0.32, 0, 0.04, 0.22, 0.22, "#B8BCCB"], [-0.19, 0.32, 0, 0.04, 0.22, 0.22, "#B8BCCB"], [0, 0.32, 0.105, 0.2, 0.06, 0.01, "#FFD23F"]]);
    case "blaster": return part("tool-blaster", [[0, 0, 0, 0.1, 0.12, 0.34, "#2AB8B0"], [0, 0.02, 0.22, 0.06, 0.06, 0.12, "#2A2D3A"], [0, -0.12, -0.06, 0.08, 0.16, 0.08, "#2A2D3A"], [0, 0.08, -0.02, 0.06, 0.04, 0.2, "#FF8A3A"], [0, 0.02, 0.29, 0.04, 0.04, 0.02, "#B8F6FF"]]);
    case "drill": return part("tool-drill", [[0, 0, 0, 0.16, 0.18, 0.34, "#FFD23F"], [0, -0.16, -0.05, 0.1, 0.2, 0.1, "#2A2D3A"], [0, 0, 0.2, 0.1, 0.1, 0.06, "#2A2D3A"], [0, 0.1, -0.08, 0.1, 0.06, 0.12, "#FF8A3A"], [0.09, 0.02, -0.06, 0.02, 0.1, 0.16, "#2A2D3A"]]);
    case "smg": return part("tool-smg", [[0, 0, 0, 0.09, 0.11, 0.3, "#3A4A3A"], [0, 0.02, 0.2, 0.05, 0.05, 0.12, "#2A2D3A"], [0, -0.13, -0.04, 0.07, 0.16, 0.07, "#2A2D3A"], [0, -0.11, 0.08, 0.06, 0.14, 0.05, "#2A2D3A"], [0, 0.07, -0.02, 0.05, 0.03, 0.18, "#7CFF6A"]]);
    case "scatter": return part("tool-scatter", [[0, 0, 0, 0.13, 0.12, 0.44, "#5A5E6E"], [0, 0, 0.26, 0.13, 0.08, 0.1, "#2A2D3A"], [0, -0.1, -0.12, 0.08, 0.14, 0.12, "#8A5A36"], [0, 0.07, -0.05, 0.08, 0.03, 0.22, "#FFB23A"]]);
    case "laser": return part("tool-laser", [[0, 0, 0, 0.1, 0.13, 0.4, "#3A3E4E"], [0, 0.01, 0.24, 0.06, 0.06, 0.1, "#FF3A6A"], [0, 0.09, -0.02, 0.08, 0.03, 0.24, "#FF3A6A"], [0, -0.12, -0.08, 0.07, 0.14, 0.08, "#2A2D3A"]]);
    case "plasma": return part("tool-plasma", [[0, 0, 0, 0.16, 0.16, 0.36, "#5A5E6E"], [0, 0, 0.22, 0.14, 0.14, 0.08, "#5CF08A"], [0, 0, 0.27, 0.1, 0.1, 0.02, "#FFFFFF"], [0, 0.11, -0.04, 0.12, 0.03, 0.2, "#5CF08A"], [0, -0.13, -0.08, 0.07, 0.12, 0.08, "#2A2D3A"]]);
    case "minigun": case "omega": { const body = id === "omega" ? "#E8B030" : "#5A5E6E", barrel = id === "omega" ? "#FFF0A0" : "#B8BCCB"; return part(`tool-${id}`, [[0, 0, 0, 0.18, 0.16, 0.3, body], [-0.04, 0.03, 0.27, 0.04, 0.04, 0.3, barrel], [0.04, 0.03, 0.27, 0.04, 0.04, 0.3, barrel], [0, -0.03, 0.27, 0.04, 0.04, 0.3, barrel], [0, 0.07, 0.27, 0.04, 0.04, 0.3, barrel], [0, 0.03, 0.43, 0.16, 0.1, 0.03, "#FFD23F"], [0, -0.14, -0.06, 0.08, 0.14, 0.08, "#2A2D3A"]]); }
    case "swarm": return part("tool-swarm", [[0, 0, 0, 0.2, 0.2, 0.42, "#4A5A3A"], [-0.05, 0.05, 0.215, 0.06, 0.06, 0.01, "#FF3A3A"], [0.05, 0.05, 0.215, 0.06, 0.06, 0.01, "#FF3A3A"], [-0.05, -0.05, 0.215, 0.06, 0.06, 0.01, "#FF3A3A"], [0.05, -0.05, 0.215, 0.06, 0.06, 0.01, "#FF3A3A"], [0, 0.13, 0, 0.12, 0.03, 0.24, "#FF8A2A"], [0, -0.16, -0.06, 0.08, 0.12, 0.08, "#2A2D3A"]]);
    case "wrecker": return part("tool-wrecker", [[0, 0, 0, 0.22, 0.22, 0.6, "#5A3A2A"], [0, 0, 0.32, 0.26, 0.26, 0.06, "#FF6A2A"], [0, 0, 0.35, 0.16, 0.16, 0.02, "#2A2D3A"], [0, 0.15, -0.05, 0.14, 0.04, 0.3, "#FFD23F"], [0, -0.17, -0.1, 0.09, 0.14, 0.09, "#2A2D3A"]]);
    case "storm": return part("tool-storm", [[0, 0, 0, 0.1, 0.12, 0.3, "#3A2A4A"], [0, 0, 0.18, 0.16, 0.16, 0.03, "#B48CFF"], [0, 0, 0.23, 0.16, 0.16, 0.03, "#B48CFF"], [0, 0, 0.28, 0.16, 0.16, 0.03, "#B48CFF"], [0, 0, 0.32, 0.04, 0.04, 0.04, "#E8DCFF"], [0, -0.12, -0.06, 0.07, 0.14, 0.07, "#2A2D3A"]]);
    case "rocket": return part("tool-rocket", [[0, 0, 0, 0.16, 0.16, 0.7, "#5A7A4A"], [0, 0, 0.36, 0.2, 0.2, 0.04, "#2A2D3A"], [0, -0.13, -0.05, 0.08, 0.14, 0.08, "#2A2D3A"], [0, 0.1, 0, 0.06, 0.04, 0.3, "#FFD23F"], [0, 0, -0.36, 0.18, 0.18, 0.02, "#2A2D3A"]]);
    case "paint": return part("tool-paint", [[0, 0, 0, 0.14, 0.26, 0.14, "#F2F2EA"], [0, 0.06, 0.071, 0.12, 0.08, 0.01, "#FF4A6A"], [0, 0.15, 0, 0.08, 0.04, 0.08, "#2A2D3A"], [0, 0.18, 0.05, 0.03, 0.03, 0.06, "#2A2D3A"]]);
  }
}
/** the spinning bit on the drill */
export const drillBit = () => part("tool-drillbit", [[0, 0, 0.05, 0.06, 0.06, 0.1, "#B8BCCB"], [0, 0, 0.12, 0.04, 0.04, 0.08, "#8A92A6"], [0, 0, 0.17, 0.02, 0.02, 0.04, "#5A5E6E"]]);

// ---------------------------------------------------------------- loot and pickups
export type PickupKind = "cash" | "gold" | "gem" | "art" | "coin" | "heart" | "oil" | "power" | "ammo" | "bombs" | "gun";
export const POWER_COL: Record<string, string> = { mega: "#FF8A3A", shield: "#5AB8FF", magnet: "#FF5AC8", speed: "#5CE07A", xray: "#C87CFF", double: "#FFD23F", rapid: "#FFE07A", rage: "#FF3A3A", boom: "#FF6A2A", freeze: "#9AF0FF" };
export function pickupGeometry(kind: PickupKind, sub = "") {
  switch (kind) {
    case "cash": return part("pk-cash", [[0, 0, 0, 0.36, 0.14, 0.2, "#5CB85A"], [0, 0, 0, 0.08, 0.15, 0.21, "#F2F2EA"], [0, 0.08, 0, 0.36, 0.02, 0.2, "#7ADA78"], [0.12, 0.075, 0, 0.06, 0.01, 0.06, "#3A8A3A"]]);
    case "gold": return part("pk-gold", [[0, 0, 0, 0.34, 0.12, 0.18, "#F2B830"], [0, 0.07, 0, 0.28, 0.04, 0.13, "#FFD86A"], [0, 0.095, 0, 0.12, 0.01, 0.06, "#FFF6C8"]]);
    case "gem": return part(`pk-gem-${sub}`, [[0, 0, 0, 0.18, 0.12, 0.18, sub || "#5BF0FF"], [0, 0.09, 0, 0.12, 0.08, 0.12, shadeHex(sub || "#5BF0FF", 0.3)], [0, -0.09, 0, 0.1, 0.08, 0.1, shadeHex(sub || "#5BF0FF", -0.2)], [0.04, 0.12, 0.04, 0.03, 0.03, 0.03, "#FFFFFF"]]);
    case "art": return part(`pk-art-${sub}`, [[0, 0, 0, 0.6, 0.46, 0.05, "#C8901A"], [0, 0, 0.026, 0.5, 0.36, 0.01, sub || "#5AB8FF"], [-0.1, -0.06, 0.032, 0.2, 0.12, 0.01, "#5CC043"], [0.12, 0.08, 0.032, 0.08, 0.08, 0.01, "#FFD23F"]]);
    case "coin": return part("pk-coin", [[0, 0, 0, 0.26, 0.26, 0.06, "#C8861A"], [0, 0, 0, 0.2, 0.2, 0.08, "#FFC93D"], [0, 0, 0.045, 0.05, 0.12, 0.01, "#FFF0A0"]]);
    case "heart": return part("pk-heart", [[-0.09, 0.06, 0, 0.16, 0.14, 0.12, "#FF3D6E"], [0.09, 0.06, 0, 0.16, 0.14, 0.12, "#FF3D6E"], [0, -0.04, 0, 0.26, 0.12, 0.12, "#FF3D6E"], [0, -0.13, 0, 0.12, 0.08, 0.12, "#FF3D6E"], [-0.08, 0.1, 0.065, 0.05, 0.04, 0.01, "#FFC0D0"]]);
    case "oil": return part("pk-oil", [[0, 0, 0, 0.26, 0.34, 0.18, "#D8302A"], [0, 0.2, -0.04, 0.08, 0.08, 0.08, "#2A2D3A"], [0, 0.2, 0.05, 0.18, 0.04, 0.04, "#2A2D3A"], [0, 0, 0.092, 0.16, 0.12, 0.01, "#FFD23F"]]);
    case "power": return part(`pk-power-${sub}`, [[0, 0, 0, 0.3, 0.3, 0.3, POWER_COL[sub] ?? "#FFD23F"], [0, 0, 0, 0.32, 0.12, 0.12, "#FFFFFF"], [0, 0, 0, 0.12, 0.32, 0.12, "#FFFFFF"], [0, 0, 0, 0.12, 0.12, 0.32, "#FFFFFF"]]);
    case "ammo": return part("pk-ammo", [[0, 0, 0, 0.42, 0.24, 0.26, "#5A6A3A"], [0, 0.03, 0, 0.44, 0.05, 0.28, "#FFD23F"], [-0.12, 0.17, 0, 0.05, 0.1, 0.05, "#E8B030"], [0, 0.17, 0, 0.05, 0.1, 0.05, "#E8B030"], [0.12, 0.17, 0, 0.05, 0.1, 0.05, "#E8B030"]]);
    case "bombs": return part("pk-bombs", [[0, 0, 0, 0.42, 0.24, 0.26, "#B8302A"], [0, 0.13, 0, 0.44, 0.03, 0.28, "#2A2D3A"], [0, 0.21, 0, 0.16, 0.14, 0.16, "#2A2D3A"], [0, 0.3, 0, 0.03, 0.06, 0.03, "#FFD23F"]]);
    case "gun": return part("pk-gun", [[0, 0, 0, 0.56, 0.22, 0.3, "#2A5AD8"], [0, 0.04, 0, 0.58, 0.04, 0.32, "#FFD23F"], [0, 0.14, 0, 0.36, 0.06, 0.1, "#E8EEF8"], [0, 0, 0.152, 0.1, 0.1, 0.01, "#9AF0FF"]]);
  }
}

export function shadeHex(c: string, t: number) {
  const n = parseInt(c.slice(1, 7), 16), f = (v: number) => Math.max(0, Math.min(255, Math.round(t >= 0 ? v + (255 - v) * t : v * (1 + t))));
  return `#${((f((n >> 16) & 255) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).padStart(6, "0")}`;
}
