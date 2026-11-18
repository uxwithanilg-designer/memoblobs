// Shared art API for Momo Sky Roll: geometry helpers (clay vertex colours + tint masks) and the contracts between the
// renderer (which computes every pose from the beat, so visuals always match the collisions) and the model builders
// in art/props.ts and art/skins.ts.
//
// Units: 1 = one tile. Tiles' tops are at y = 0. The track runs towards −z (forward). Lanes are x = …, −1, 0, 1, ….
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// ---------------------------------------------------------------- geometry helpers (for instanced props)
/**
 * Give a part a vertex colour, a tint mask (1 = takes the mood's tint colour, 0 = keeps `color`) and a glow amount
 * (emissive at night). Returns a non-indexed copy ready for `merge`.
 */
export function paint(g: THREE.BufferGeometry, color: number, tint: number, glow = 0) {
  const n = g.attributes.position.count;
  const c = new THREE.Color(color);
  const col = new Float32Array(n * 3), t = new Float32Array(n), gl = new Float32Array(n);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; t[i] = tint; gl[i] = glow; }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("aTint", new THREE.BufferAttribute(t, 1));
  g.setAttribute("aGlow", new THREE.BufferAttribute(gl, 1));
  return g.index ? g.toNonIndexed() : g;
}

/** transform a geometry in place: position, scale, euler rotation */
export const place = (g: THREE.BufferGeometry, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  return g.applyMatrix4(m);
};

/** merge painted parts into one geometry (all parts must come from `paint`) */
export const merge = (parts: THREE.BufferGeometry[]) => {
  const g = mergeGeometries(parts.map((p) => { if (p.attributes.uv) p.deleteAttribute("uv"); if (p.attributes.uv1) p.deleteAttribute("uv1"); return p; }), false)!;
  parts.forEach((p) => p.dispose());
  g.computeVertexNormals();
  return g;
};

/** a soft clay material for hazard / boss / character meshes */
export const std = (color: number, o: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0, ...o });

/** an emissive "glowing" material (neon, lava, lasers) */
export const glow = (color: number, intensity = 1.6) =>
  new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });

export function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return [c, c.getContext("2d")!] as const;
}

// ---------------------------------------------------------------- hazard view contracts
// Every view's root `group` is placed by the renderer at (hazard lane x, floor y, −row). Build models around the origin.

/** H01 mallet-style pendulum. Pivot is at local (0, PIVOT_Y, 0) — see hazards.ts MALLET_PIVOT_Y (9.1) / MALLET_LEN (8.6).
 *  The renderer sets: head.position (x, y) + head.rotation.z, rope.position (midpoint) + rope.rotation.z + rope.scale.y = length.
 *  So `rope` must be a unit-length (1) thin cylinder centred on its origin along Y. `top` sits at the pivot (a cloud, beam…).
 *  The head's collision is a sphere of radius 0.5 (cylinder 0.92 long along z) — keep the visible head about that size. */
export interface PendulumView { group: THREE.Group; head: THREE.Object3D; rope: THREE.Object3D; top: THREE.Object3D }

/** H02 spinner: arms lie flat at y ≈ 0.3 and reach from the core (radius 0.52) out to `len` along +x of `spin`.
 *  `arms` arms evenly spaced. The renderer sets spin.rotation.y. Collision = capsules of radius 0.2, core radius 0.52. */
export interface SpinnerView { group: THREE.Group; spin: THREE.Object3D }

/** H05 / H31 dropper: something that falls from the sky and slams lanes x−w/2 … x+w/2 (w = lanes covered).
 *  The renderer moves group.position.y from ~10 (up) to 0 (slammed). setOpen(k) 0..1 can animate jaws / squash. */
export interface DropperView { group: THREE.Group; setOpen(k: number): void }

/** H04 / H07 slider: an obstacle `w` lanes wide (centred on x = 0), ≤ 0.9 deep along z, ≤ 1.1 tall.
 *  The renderer sets group.position.x. tick(t, beat) is optional idle animation (wheels, flippers, eyes). */
export interface SliderView { group: THREE.Group; tick?(t: number, beat: number): void }

/** H08 roller: a round thing of radius `r` rolling towards Momo along a lane. The renderer moves group along z
 *  and sets roll.rotation.x. Its centre is at y = r. */
export interface RollerView { group: THREE.Group; roll: THREE.Object3D }

/** H06 popper: pops out of the floor. setUp(k): 0 = fully hidden under the tiles, 1 = fully up (danger ≈ 1.1 tall). */
export interface PopperView { group: THREE.Group; setUp(k: number): void }

/** H11 laser / doors: spans lanes −w/2 … +w/2 at ball height. setOn(k): 0 = open / off, 1 = closed / on (blocking). */
export interface LaserView { group: THREE.Group; setOn(k: number): void }

/** B01–B15 boss set piece. Placed beside / above the track ahead of Momo; `k` 0..1 = how active the attack phase is. */
export interface BossView { group: THREE.Group; update(t: number, beat: number, k: number): void }

/** a playable character ball: `body` (radius 0.34, rolls), `top` stays upright on top of the ball (sprout, hat, ears, antenna…) */
export interface BallView { group: THREE.Group; body: THREE.Mesh; top: THREE.Object3D }

// ---------------------------------------------------------------- skin ids (every id must be implemented in art/skins.ts)
export const SKINS = {
  pendulum: ["mallet", "axe", "sign", "metronome", "lantern", "anchor", "icicle", "bell"],
  spinner: ["daisy", "windmill", "door", "broom", "top", "mixer", "fan", "starfish", "gear", "propeller"],
  dropper: ["claw", "crusher", "stomper", "book", "rock", "lightning", "firework", "anvil", "jelly", "meteor", "piston"],
  slider: ["block", "crystal", "toycar", "penguin", "noodle", "turbo", "saw", "gloop", "cake", "pins", "hedge", "laserpost", "cannonball", "crate", "ghost", "crab", "cart", "grumpy"],
  roller: ["barrel", "snowball", "boulder", "donut", "bowling", "tumbleweed", "wheel", "orb"],
  popper: ["pillar", "geyser", "jack", "mushroom", "spring", "jet", "ball", "flame", "tentacle"],
  laser: ["laser", "doors", "sparkler", "web", "bars"],
} as const;

export const BOSSES = [
  "kranky-giant", "gloop-king", "mothership", "mega-robot", "volcano", "wave", "avalanche", "tower",
  "train", "dragon-kite", "storm-machine", "mirror-momo", "clock", "pinball", "piano",
] as const;

export const CHARACTER_IDS = ["momo", "kranky", "tiki", "pip", "gloop", "hoot", "bonbon", "zib", "turbo", "bolt", "noodle"] as const;
export type CharacterId = (typeof CHARACTER_IDS)[number];
