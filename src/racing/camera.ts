// Professional racing camera rig.
// - Chase cams smooth the *offset* (direction, distance, height, side shift) instead of the world position,
//   so the camera never falls behind at 300 km/h but still swings naturally in drifts and corners.
// - Looks into upcoming corners, rolls a little with steering/banking, punches the FOV on nitro,
//   dips on high speed, bumps on landings and shakes (smooth noise, not jitter) on impacts.
// - Cinematics: grid flyover with hero shots before the countdown, victory orbit and trackside TV cameras after the flag.
import * as THREE from "three";
import type { CameraView } from "./types";
import type { Track } from "./track";

export interface CamTarget {
  pos: THREE.Vector3; quat: THREE.Quaternion; s: number; d: number;
  v: number; vmax: number; boosting: boolean; drifting: boolean; driftDir: number; steer: number; air: boolean;
  dims: { length: number; width: number; height: number };
  cams: { hood: THREE.Vector3; bumper: THREE.Vector3 };
}

const UP = new THREE.Vector3(0, 1, 0);
const VIEWS: Record<"chase" | "far", { dist: number; h: number; look: number }> = {
  chase: { dist: 5.9, h: 2.05, look: 1.05 },
  far: { dist: 8.8, h: 3.25, look: 1.2 },
};
const ease = (u: number) => u * u * (3 - 2 * u);

export class CameraRig {
  view: CameraView;
  private dir = new THREE.Vector3(0, 0, 1);
  private dist = 6; private h = 2.2; private side = 0; private lookSide = 0; private roll = 0; private steerS = 0;
  private fovExtra = 0; private boostAmt = 0;
  private shakeAmt = 0; private bump = 0; private t = 0;
  private look = new THREE.Vector3();
  private tv: { pos: THREE.Vector3; until: number } | null = null;
  private v1 = new THREE.Vector3(); private v2 = new THREE.Vector3(); private v3 = new THREE.Vector3(); private v4 = new THREE.Vector3();
  constructor(public camera: THREE.PerspectiveCamera, view: CameraView) { this.view = view; }

  cycle() { const v: CameraView[] = ["chase", "far", "hood", "bumper"]; this.view = v[(v.indexOf(this.view) + 1) % v.length]; return this.view; }
  kick(amount: number) { this.shakeAmt = Math.min(1, Math.max(this.shakeAmt, amount)); }
  land(amount: number) { this.bump = Math.min(0.6, amount); }

  update(dt: number, c: CamTarget, track: Track, phase: "intro" | "race" | "finish", phaseT: number, ground: (x: number, z: number) => number) {
    this.t += dt;
    const cam = this.camera;
    const carF = this.v1.set(0, 0, 1).applyQuaternion(c.quat);
    const right = track.right(c.s, this.v2);
    const roadF = track.tangent(c.s, this.v3);
    const s01 = Math.min(1.25, Math.max(0, c.v) / c.vmax);
    this.steerS += (c.steer - this.steerS) * Math.min(1, dt * 4);
    this.boostAmt += ((c.boosting ? 1 : 0) - this.boostAmt) * Math.min(1, dt * (c.boosting ? 5 : 2.5));
    const pos = new THREE.Vector3(), look = new THREE.Vector3();
    let fov = 60, rollT = 0;

    if (phase === "intro") {
      // flyover: wide front shot → low hero shot → settle behind the car
      const u = Math.min(1, phaseT / 2.4);
      const L = c.dims.length;
      const k0 = new THREE.Vector3().copy(c.pos).addScaledVector(carF, 16 + L).addScaledVector(right, -9).addScaledVector(UP, 5.5);
      const k1 = new THREE.Vector3().copy(c.pos).addScaledVector(carF, 4 + L * 0.6).addScaledVector(right, 3.2).addScaledVector(UP, 0.75);
      const k2 = new THREE.Vector3().copy(c.pos).addScaledVector(roadF, -VIEWS.chase.dist - L * 0.2).addScaledVector(UP, VIEWS.chase.h + c.dims.height * 0.3);
      if (u < 0.5) pos.lerpVectors(k0, k1, ease(u / 0.5)); else pos.lerpVectors(k1, k2, ease((u - 0.5) / 0.5));
      look.copy(c.pos).addScaledVector(UP, 0.7).addScaledVector(roadF, u * 6);
      fov = 48 + u * 12;
      this.dir.copy(roadF); this.dist = VIEWS.chase.dist + L * 0.2; this.h = VIEWS.chase.h + c.dims.height * 0.3; this.look.copy(look);
      this.place(pos, look, fov, 0);
      return;
    }

    if (phase === "finish" && phaseT > 0.2) {
      if (phaseT < 4.2) {
        // victory orbit
        const ang = 0.6 + (phaseT - 0.2) * 0.55;
        const r = 6.5 + c.dims.length * 0.4;
        pos.copy(c.pos).addScaledVector(roadF, Math.cos(ang) * r).addScaledVector(right, Math.sin(ang) * r).addScaledVector(UP, 1.6 + Math.sin(phaseT * 0.6) * 0.4);
        look.copy(c.pos).addScaledVector(UP, 0.7);
        this.place(pos, look, 52, 0);
        return;
      }
      // trackside TV cameras that pan with the car
      if (!this.tv || track.delta(c.s, this.tv.until) < -6) {
        const ahead = 45 + Math.random() * 25, sideD = (Math.random() < 0.5 ? -1 : 1) * (track.halfWidth + track.shoulder + 3);
        const p = track.point(c.s + ahead, sideD, new THREE.Vector3()); p.y += 2.5 + Math.random() * 3;
        this.tv = { pos: p, until: track.wrap(c.s + ahead) };
      }
      const dist = this.tv.pos.distanceTo(c.pos);
      this.place(this.tv.pos, look.copy(c.pos).addScaledVector(UP, 0.6), THREE.MathUtils.clamp(2400 / Math.max(8, dist) / 2, 18, 55), 0);
      return;
    }

    if (this.view === "hood" || this.view === "bumper") {
      const bumper = this.view === "bumper";
      pos.copy(bumper ? c.cams.bumper : c.cams.hood).applyQuaternion(c.quat).add(c.pos);
      look.copy(pos).addScaledVector(carF, 30).addScaledVector(UP, bumper ? 0.15 : -0.6);
      fov = (bumper ? 74 : 68) + s01 * 12 + this.boostAmt * 10;
      rollT = -this.steerS * 0.012;
      this.roll += (rollT - this.roll) * Math.min(1, dt * 6);
      this.shake(pos, s01, c, 0.5);
      this.place(pos, look, fov, this.roll);
      return;
    }

    // ------------------------------------------------------------ chase / far
    const V = VIEWS[this.view === "far" ? "far" : "chase"];
    // heading: mostly the road, partly the car — so a drift shows the car's angle
    const want = this.v4.copy(roadF).lerp(carF, c.drifting ? 0.22 : 0.4);
    want.y *= 0.6; want.normalize();
    this.dir.lerp(want, 1 - Math.exp(-dt * (c.drifting ? 3.2 : 5.5))).normalize();
    // portrait screens are narrow: pull back and up so the road ahead stays visible
    const portrait = Math.max(0, Math.min(1, (1.1 - cam.aspect) / 0.6));
    const dWant = (V.dist + c.dims.length * 0.22 + s01 * 0.9 + this.boostAmt * 1.3 + (c.air ? 1 : 0)) * (1 + portrait * 0.35);
    const hWant = (V.h + c.dims.height * 0.3 - s01 * 0.3 + (c.air ? 0.7 : 0)) * (1 + portrait * 0.3);
    this.dist += (dWant - this.dist) * Math.min(1, dt * 2.5);
    this.h += (hWant - this.h) * Math.min(1, dt * 2.5);
    // shift slightly to the outside while steering, and look into the coming corner
    // (a narrow portrait frame has little horizontal room, so side shifts shrink there to keep the car centred)
    const kAhead = track.kappaAhead(c.s, 10, 30 + c.v * 0.8);
    const sideK = 1 - portrait * 0.65;
    this.side += ((-this.steerS * 0.55 - (c.drifting ? c.driftDir * 0.7 : 0)) * sideK - this.side) * Math.min(1, dt * 3);
    this.lookSide += (THREE.MathUtils.clamp(kAhead * 520, -3, 3) * sideK - this.lookSide) * Math.min(1, dt * 2.5);
    const sideV = this.v2.crossVectors(this.dir, UP).normalize(); // camera's right
    pos.copy(c.pos).addScaledVector(this.dir, -this.dist).addScaledVector(UP, this.h).addScaledVector(sideV, -this.side);
    // landing bump
    this.bump = Math.max(0, this.bump - dt * 2.5);
    pos.y -= Math.sin(this.bump * Math.PI * 3) * this.bump * 0.35;
    const lookAhead = 4.5 + s01 * 6.5;
    look.copy(c.pos).addScaledVector(this.dir, lookAhead).addScaledVector(UP, V.look + c.dims.height * 0.12).addScaledVector(sideV, this.lookSide);
    this.look.lerp(look, 1 - Math.exp(-dt * 12));
    // keep above the ground
    const gy = ground(pos.x, pos.z) + 0.9;
    if (pos.y < gy) pos.y = gy;
    fov = 58 + s01 * 15 + this.boostAmt * 10;
    rollT = -this.steerS * 0.025 * Math.min(1, s01 * 1.5) + track.bankAt(c.s) * 0.4 + (c.drifting ? c.driftDir * 0.02 : 0);
    this.roll += (rollT - this.roll) * Math.min(1, dt * 4);
    this.shake(pos, s01, c, 1);
    this.place(pos, this.look, fov, this.roll);
  }

  /** smooth "camera operator" shake: impacts + very high speed + nitro rumble */
  private shake(pos: THREE.Vector3, s01: number, c: CamTarget, k: number) {
    this.shakeAmt = Math.max(0, this.shakeAmt - 0.016 * 2.2);
    const amp = (this.shakeAmt * 0.45 + Math.max(0, s01 - 0.8) * 0.06 + this.boostAmt * 0.035 + (c.air ? 0 : 0)) * k;
    if (amp <= 0.0005) return;
    const t = this.t;
    pos.x += (Math.sin(t * 37.1) + Math.sin(t * 23.7) * 0.6) * amp * 0.5;
    pos.y += (Math.sin(t * 41.3) + Math.sin(t * 19.1) * 0.5) * amp * 0.45;
    pos.z += Math.sin(t * 29.3) * amp * 0.4;
  }

  private place(pos: THREE.Vector3, look: THREE.Vector3, fov: number, roll: number) {
    const cam = this.camera;
    cam.position.copy(pos);
    cam.up.set(Math.sin(roll), Math.cos(roll), 0);
    // roll about the viewing direction
    const fwd = this.v4.subVectors(look, pos).normalize();
    const r = new THREE.Vector3().crossVectors(fwd, UP).normalize();
    cam.up.copy(UP).applyAxisAngle(fwd, roll);
    void r;
    cam.lookAt(look);
    this.fovExtra += (fov - this.fovExtra) * 0.2;
    if (Math.abs(cam.fov - this.fovExtra) > 0.05) { cam.fov = this.fovExtra; cam.updateProjectionMatrix(); }
  }
}
