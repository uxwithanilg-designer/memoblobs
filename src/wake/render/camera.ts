// The camera director of Wake Racers. Shots: a slow orbit of your boat on the home screen; a drone fly-over of the
// course before each race (letterboxed, with the stage card); a low front shot of the grid for the countdown; the chase
// camera (it trails the boat's real direction of travel so slides read, widens the lens and drops lower with speed,
// leans into turns, shakes on knocks and landings, never pokes through the banks); a side tracking shot in slow motion
// for big jumps and waterfalls; slow motion across the finish line then a victory orbit; a slow orbit when you're
// wrecked. Shots blend smoothly into each other. No allocation per frame.
import * as THREE from "three";
import { DS, PRE, halfWidthAt, locate, place, waterAt, type Course } from "../course";
import { clamp, lerp, smooth } from "../util";
import type { Boat } from "../physics";

export type Shot = "home" | "flyover" | "grid" | "chase" | "air" | "finish" | "orbit" | "wreck";

export class CameraDirector {
  shot: Shot = "home";
  t = 0;
  /** game time runs at this rate (slow motion) */
  timeScale = 1;
  /** 0..1 cinematic bars */
  letterbox = 0;
  readonly pos = new THREE.Vector3(0, 5, -10);
  readonly look = new THREE.Vector3();
  fov = 60; roll = 0;
  private fromPos = new THREE.Vector3(); private fromLook = new THREE.Vector3(); private blend = 1; private blendT = 0.6;
  private tPos = new THREE.Vector3(); private tLook = new THREE.Vector3();
  private shakeAmt = 0; private shakeT = 0;
  private airSide = 1; private slowT = 0; private slowK = 1;
  private p = { x: 0, z: 0 };
  private loc = { i: 0, s: 0, d: 0 };
  portrait = false;
  /** the course stretch the fly-over covers */
  flyLen = 400; flyTime = 4.2;

  constructor(private c: Course) {}

  setCourse(c: Course) { this.c = c; }

  cut(shot: Shot, blend = 0) {
    this.fromPos.copy(this.pos); this.fromLook.copy(this.look);
    this.shot = shot; this.t = 0;
    this.blend = blend > 0 ? 0 : 1; this.blendT = blend;
    if (shot === "air") this.airSide = Math.random() < 0.5 ? -1 : 1;
  }
  /** slow motion for a while (real seconds) */
  slowMo(k: number, seconds: number) { this.slowK = k; this.slowT = seconds; }
  shake(a: number) { this.shakeAmt = Math.min(1.2, Math.max(this.shakeAmt, a)); }

  update(dt: number, b: Boat, speed01: number, boosting: boolean) {
    this.t += dt;
    const c = this.c;
    if (this.slowT > 0) { this.slowT -= dt; this.timeScale += (this.slowK - this.timeScale) * Math.min(1, dt * 10); }
    else this.timeScale += (1 - this.timeScale) * Math.min(1, dt * 4);
    const hx = Math.sin(b.heading), hz = Math.cos(b.heading);
    const sp = Math.hypot(b.vx, b.vz);
    // direction of travel (follows the slide), blended with the hull's heading
    let dx = hx, dz = hz;
    if (sp > 3) { dx = lerp(hx, b.vx / sp, 0.55); dz = lerp(hz, b.vz / sp, 0.55); const l = Math.hypot(dx, dz); dx /= l; dz /= l; }
    let fovT = this.portrait ? 70 : 58, lb = 0, rollT = 0;
    switch (this.shot) {
      case "home": {
        const a = this.t * 0.12 + 2.3, r = this.portrait ? 11.5 : 9.5;
        this.tPos.set(b.x + Math.sin(a) * r, b.y + 2.6 + Math.sin(this.t * 0.3) * 0.4, b.z + Math.cos(a) * r);
        this.tLook.set(b.x, b.y + 1.1, b.z);
        fovT = this.portrait ? 62 : 48;
        break;
      }
      case "flyover": {
        const u = clamp(this.t / this.flyTime, 0, 1), e = smooth(u);
        const s = lerp(-20, this.flyLen, e);
        place(c, s, Math.sin(u * 3.2) * 10, this.p);
        const y = waterAt(c, s) + lerp(46, 22, e) + Math.sin(u * Math.PI) * 8;
        this.tPos.set(this.p.x, y, this.p.z);
        place(c, s + 90, 0, this.p);
        this.tLook.set(this.p.x, waterAt(c, s + 90), this.p.z);
        fovT = this.portrait ? 74 : 60; lb = 1; rollT = Math.sin(u * 5) * 0.05;
        break;
      }
      case "grid": {
        const sx = Math.cos(b.heading), sz = -Math.sin(b.heading); // right vector (−cos, sin) mirrored: camera on the left
        const u = smooth(clamp(this.t / 3.4, 0, 1));
        this.tPos.set(b.x + hx * lerp(11, 6, u) + sx * lerp(6, 3.5, u), b.y + lerp(1.4, 2.2, u), b.z + hz * lerp(11, 6, u) + sz * lerp(6, 3.5, u));
        this.tLook.set(b.x - hx * 3, b.y + 0.9, b.z - hz * 3);
        fovT = this.portrait ? 66 : 50; lb = 1 - u * 0.4;
        break;
      }
      case "chase": {
        // portrait screens: higher and tilted down, so the water fills the tall picture (horizon about a third down)
        const dist = (this.portrait ? 10.5 : 8.4) + speed01 * (this.portrait ? 1.4 : 1.6), h = (this.portrait ? 5.2 : 3.1) + speed01 * (this.portrait ? 0.4 : 0.3);
        this.tPos.set(b.x - dx * dist, b.y + h, b.z - dz * dist);
        const ahead = 7 + speed01 * 7;
        this.tLook.set(b.x + dx * ahead, b.y + (this.portrait ? 0.2 : 1.1), b.z + dz * ahead);
        fovT += speed01 * 12 + (boosting ? 7 : 0);
        rollT = clamp(-b.yaw * 0.05 * clamp(sp / 20, 0, 1), -0.08, 0.08);
        break;
      }
      case "air": {
        // alongside, a little ahead, looking back at the boat in flight
        const rx = -hz * this.airSide, rz = hx * this.airSide;
        this.tPos.set(b.x + rx * 9 + hx * 4, b.y + 1.2, b.z + rz * 9 + hz * 4);
        this.tLook.set(b.x, b.y + 0.6, b.z);
        fovT = this.portrait ? 68 : 54; lb = 1;
        break;
      }
      case "finish": {
        const rx = -hz, rz = hx;
        this.tPos.set(b.x + hx * 10 + rx * 4, b.y + 1.3, b.z + hz * 10 + rz * 4);
        this.tLook.set(b.x, b.y + 0.9, b.z);
        fovT = this.portrait ? 64 : 48; lb = 1;
        break;
      }
      case "orbit": case "wreck": {
        const a = this.t * (this.shot === "wreck" ? 0.25 : 0.35), r = this.portrait ? 12 : 10;
        this.tPos.set(b.x + Math.sin(a) * r, b.y + (this.shot === "wreck" ? 5 : 3), b.z + Math.cos(a) * r);
        this.tLook.set(b.x, b.y + 0.8, b.z);
        fovT = this.portrait ? 64 : 50; lb = 1;
        break;
      }
    }
    // keep the camera over the water and inside the lane (never through a cliff or a quay wall)
    if (this.shot === "chase" || this.shot === "air" || this.shot === "finish" || this.shot === "grid") {
      locate(c, this.tPos.x, this.tPos.z, (b.s + PRE) / DS, this.loc);
      const hw = halfWidthAt(c, this.loc.s) - 0.6;
      if (Math.abs(this.loc.d) > hw) {
        place(c, this.loc.s, Math.sign(this.loc.d) * hw, this.p);
        this.tPos.x = this.p.x; this.tPos.z = this.p.z;
      }
      this.tPos.y = Math.max(this.tPos.y, waterAt(c, this.loc.s) + 1.1);
    }
    // ease towards the shot (the chase camera has a little lag: weight)
    const kp = this.shot === "chase" ? 7.5 : this.shot === "flyover" ? 20 : 4, kl = this.shot === "chase" ? 12 : 6;
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt / Math.max(0.01, this.blendT));
      const e = smooth(this.blend);
      this.pos.lerpVectors(this.fromPos, this.tPos, e); this.look.lerpVectors(this.fromLook, this.tLook, e);
    } else {
      this.pos.x += (this.tPos.x - this.pos.x) * Math.min(1, dt * kp);
      this.pos.y += (this.tPos.y - this.pos.y) * Math.min(1, dt * kp);
      this.pos.z += (this.tPos.z - this.pos.z) * Math.min(1, dt * kp);
      this.look.x += (this.tLook.x - this.look.x) * Math.min(1, dt * kl);
      this.look.y += (this.tLook.y - this.look.y) * Math.min(1, dt * kl);
      this.look.z += (this.tLook.z - this.look.z) * Math.min(1, dt * kl);
    }
    this.fov += (fovT - this.fov) * Math.min(1, dt * 3);
    this.roll += (rollT - this.roll) * Math.min(1, dt * 4);
    this.letterbox += (lb - this.letterbox) * Math.min(1, dt * 3.5);
    // shake
    if (this.shakeAmt > 0.001) {
      this.shakeT += dt * 38;
      const a = this.shakeAmt * 0.35;
      this.pos.x += Math.sin(this.shakeT * 1.3) * a; this.pos.y += Math.sin(this.shakeT * 1.7 + 1) * a * 0.7; this.pos.z += Math.cos(this.shakeT * 1.1) * a;
      this.shakeAmt *= Math.exp(-dt * 6);
    }
  }

  /** write the shot into a three.js camera */
  apply(cam: THREE.PerspectiveCamera) {
    cam.position.copy(this.pos);
    cam.up.set(0, 1, 0);
    cam.lookAt(this.look);
    if (this.roll) cam.rotateZ(this.roll);
    if (Math.abs(cam.fov - this.fov) > 0.05) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
  }
}
