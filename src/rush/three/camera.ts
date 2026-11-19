// The cinematic camera. Normally a spring-damped chase camera low behind Rollo, looking ahead down the track, leaning
// with the banking and pulling back as speed rises (wider lens at Turbo and Moon Rush). Set pieces get their own shots,
// blended in and out smoothly: loops are filmed from the side, the waterfall drop from above, the sea bridge low and
// wide, spring jumps from higher up, bosses with both of you in frame. Each stage opens with a fly-in round Rollo and
// ends with a slow orbit at the goal. Hits and big landings shake it.
import * as THREE from "three";
import type { Track } from "../track";
import type { SegTag } from "../types";

export type Shot = "chase" | "intro" | "goal" | "respawn";
export interface CamCtx {
  s: number; u: number; h: number; v: number; run: number; air: boolean; ball: boolean; tag: SegTag; turbo: boolean; rush: boolean;
  /** the boss's track spot, when there is one */
  boss?: { s: number; u: number } | null;
  /** distance into the current loop and its length (for the side shot) */
  loop?: { s0: number; len: number } | null;
  portrait: boolean; dt: number; time: number;
  /** a camera twist for this stretch (side-on, top-down, from the front, bird's-eye, eye view…) */
  mode?: string | null;
  /** the whole stage runs with the camera in front, looking back */
  front?: boolean;
  /** where Mayamma is (track space), while she is here */
  hag?: { s: number; u: number; h: number } | null;
}

const V = () => new THREE.Vector3();
const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt);

export class CineCam {
  shot: Shot = "intro";
  private t = 0;
  private pos = V(); private look = V(); private up = new THREE.Vector3(0, 1, 0); private fov = 70;
  private shake = 0;
  private modeFov = 0;
  private first = true;
  private fr = new Float32Array(12);
  private P = [0, 0, 0];
  /** weights of the special shots (0..1), eased */
  private w = { loop: 0, falls: 0, bridge: 0, air: 0, boss: 0, mode: 0 };
  private lastMode = "";
  private inWitch = false;
  constructor(readonly cam: THREE.PerspectiveCamera, private tr: Track) {}
  setTrack(tr: Track, keep = false) { this.tr = tr; if (!keep) this.first = true; }
  /** carry on smoothly from wherever the camera is now (after a scripted shot) */
  adopt(pos: THREE.Vector3, look: THREE.Vector3, fov: number) { this.pos.copy(pos); this.look.copy(look); this.up.set(0, 1, 0); this.fov = fov; this.first = false; this.shot = "chase"; }
  play(s: Shot) { this.shot = s; this.t = 0; if (s === "intro") this.first = true; }
  kick(k: number) { this.shake = Math.max(this.shake, k); }

  private wp(s: number, u: number, h: number, out = V()) { this.tr.point(s, u, h, this.P); return out.set(this.P[0], this.P[1], this.P[2]); }

  update(c: CamCtx) {
    const dt = c.dt; this.t += dt;
    const tr = this.tr, fr = this.tr.frame(c.s, this.fr);
    const runner = this.wp(c.s, c.u, c.h + 0.75);
    const tUp = new THREE.Vector3(fr[6], fr[7], fr[8]);
    const fwd = new THREE.Vector3(fr[3], fr[4], fr[5]);
    // ---- chase (the base of every shot)
    const fast = Math.max(0, c.v - c.run);
    // close enough that Rollo reads clearly on a phone, far enough to see what is coming
    const back = 3.8 + Math.min(2.6, fast * 0.14) + (c.portrait ? 0.4 : 0);
    const height = 1.72 + (c.portrait ? 0.3 : 0);
    let pos = this.wp(c.s - back, c.u * 0.65, height);
    let look = this.wp(c.s + 5 + c.v * 0.16, c.u * 0.8, 1.0);
    const up = this.tr.frame(c.s - back, new Float32Array(12)).slice(6, 9) as unknown as number[];
    let upV = new THREE.Vector3(up[0], up[1], up[2]);
    // keep the horizon calmer than the track: blend the track up with world up (but follow it fully in loops)
    upV.lerp(new THREE.Vector3(0, 1, 0), c.tag === "loop" ? 0 : 0.55).normalize();
    // ---- special shots, eased in and out
    const ease = (key: keyof typeof this.w, on: boolean, k = 3) => { this.w[key] += ((on ? 1 : 0) - this.w[key]) * damp(k, dt); return this.w[key]; };
    const wl = ease("loop", !!c.loop, 4), wf = ease("falls", c.tag === "falls", 3), wb = ease("bridge", c.tag === "bridge", 1.5);
    const wa = ease("air", c.air && c.h > 2.2, 3), wbo = ease("boss", !!c.boss, 1.5);
    if (wl > 0.001 && c.loop) {
      // film the loop from the side, from outside its circle
      const mid = c.loop.s0 + c.loop.len / 2;
      const a = this.wp(c.loop.s0, 0, 0), b = this.wp(mid, 0, 0);
      const centre = a.clone().add(b).multiplyScalar(0.5);
      const side = this.wp(c.loop.s0, -1, 0).sub(a).normalize();
      const r = a.distanceTo(b) / 2;
      const p = centre.clone().addScaledVector(side, r * 2.4 + 6).add(new THREE.Vector3(0, 1.5, 0)).addScaledVector(this.wp(c.loop.s0 + 1, 0, 0).sub(a).normalize(), -r * 0.6);
      pos.lerp(p, wl); look.lerp(runner.clone().lerp(centre, 0.35), wl); upV.lerp(new THREE.Vector3(0, 1, 0), wl).normalize();
    }
    if (wf > 0.001) {
      // down the waterfall: from above and behind, looking down the drop
      // behind and a little above along the slope, looking down the rushing water
      const p = this.wp(c.s - 7.5, c.u * 0.5, 3.2);
      pos.lerp(p, wf); look.lerp(this.wp(c.s + 12, c.u * 0.7, 0), wf); upV.lerp(new THREE.Vector3(0, 1, 0), wf * 0.6).normalize();
    }
    if (wb > 0.001) {
      // the sea bridge: low, wide, a little to the side, the moon ahead
      const p = this.wp(c.s - back - 1.5, c.u * 0.6 + 2.6, 1.3);
      pos.lerp(p, wb * 0.8);
    }
    if (wa > 0.001) {
      const p = this.wp(c.s - back - 2, c.u * 0.5, c.h + 2.6);
      pos.lerp(p, wa * 0.8); look.lerp(runner, wa * 0.4);
    }
    // ---- camera twists: eased in over half a second, eased out after
    // Mayamma’s entrance is a hard cut in, and a hard cut back out
    const witchShot = c.mode === "witch";
    if (witchShot !== this.inWitch) { this.inWitch = witchShot; this.first = true; this.w.mode = witchShot ? 1 : 0; if (this.shot === "intro" || this.shot === "respawn") this.shot = "chase"; }
    const wm = ease("mode", !!c.mode || !!c.front, 2.5);
    if (c.mode || c.front) this.lastMode = c.front ? "front" : c.mode!;
    if (wm > 0.001 && this.lastMode) {
      const right = new THREE.Vector3(fr[9], fr[10], fr[11]);
      let p = pos.clone(), l = look.clone(), u2 = upV.clone(), dfov = 0;
      switch (this.lastMode) {
        case "side": p = runner.clone().addScaledVector(right, 7.5).addScaledVector(tUp, 1.4).addScaledVector(fwd, 1.5); l = runner.clone().addScaledVector(fwd, 2.5); break;
        case "top": p = runner.clone().addScaledVector(tUp, 13).addScaledVector(fwd, -3); l = runner.clone().addScaledVector(fwd, 5); break;
        case "front": p = runner.clone().addScaledVector(fwd, 6.5).addScaledVector(tUp, 1.6); l = runner.clone().addScaledVector(fwd, -4); break;
        case "birds": p = runner.clone().addScaledVector(tUp, 20).addScaledVector(fwd, 1); l = runner.clone().addScaledVector(fwd, 2); u2 = fwd.clone(); break;
        case "slowmo": p = runner.clone().addScaledVector(right, 3.2).addScaledVector(tUp, 0.6).addScaledVector(fwd, -2); l = runner.clone(); dfov = -12; break;
        case "tilt": u2 = upV.clone().applyAxisAngle(fwd, 0.35); break;
        case "wide": p = this.wp(c.s - 14, c.u * 0.4, 6); dfov = 10; break;
        case "eye": p = runner.clone().addScaledVector(tUp, 0.55).addScaledVector(fwd, 0.4); l = runner.clone().addScaledVector(fwd, 12).addScaledVector(tUp, 0.4); dfov = 6; break;
        case "drone": p = runner.clone().addScaledVector(right, -6).addScaledVector(tUp, 4).addScaledVector(fwd, -2); l = runner.clone().addScaledVector(fwd, 3); break;
        case "photo": { const a2 = this.t * 0.5; p = runner.clone().addScaledVector(fwd, Math.cos(a2) * 4).addScaledVector(right, Math.sin(a2) * 4).addScaledVector(tUp, 0.8); l = runner.clone(); break; }
        case "lens": dfov = 18; break;
        case "rear": p = this.wp(c.s - back * 0.7, c.u * 0.65, height * 0.8); break;
        // Mayamma drops in: low over Rollo's shoulder, looking up at her looming over the track ahead
        case "witch": { const at = c.hag ? this.wp(c.hag.s, c.hag.u, c.hag.h + 1.3) : runner.clone().addScaledVector(fwd, 8).addScaledVector(tUp, 4); p = runner.clone().addScaledVector(fwd, -3.2).addScaledVector(right, 0.9).addScaledVector(tUp, 0.4); l = at.lerp(runner, 0.3); dfov = -6; break; }
      }
      pos.lerp(p, wm); look.lerp(l, wm); upV.lerp(u2, wm).normalize();
      this.modeFov = dfov * wm;
    } else this.modeFov = 0;
    if (wbo > 0.001 && c.boss) {
      const p = this.wp(c.s - back - 3, c.u * 0.4, height + 1.6);
      const bl = this.wp(c.boss.s, c.boss.u, 2.2);
      pos.lerp(p, wbo); look.lerp(runner.clone().lerp(bl, 0.45), wbo);
    }
    // ---- intro fly-in: from in front of Rollo, round to behind him
    if (this.shot === "intro") {
      const k = Math.min(1, this.t / 2.4), e = k * k * (3 - 2 * k);
      const ang = (1 - e) * Math.PI * 1.1;
      const right = new THREE.Vector3(fr[9], fr[10], fr[11]);
      const dist = 3.6 + e * (back - 3.6);
      const p = runner.clone().addScaledVector(fwd, -Math.cos(ang) * dist).addScaledVector(right, Math.sin(ang) * dist).addScaledVector(tUp, 0.6 + e * (height - 0.6));
      pos = p; look = runner.clone().addScaledVector(tUp, -0.1).addScaledVector(fwd, e * 6); upV = tUp.clone().lerp(new THREE.Vector3(0, 1, 0), 0.5).normalize();
      if (k >= 1) this.shot = "chase";
    } else if (this.shot === "goal") {
      // the title: a slow, low hero orbit in front of Rollo (he stands in the lower half, under the logo)
      const ang = Math.sin(this.t * 0.28) * 0.95;
      const right = new THREE.Vector3(fr[9], fr[10], fr[11]);
      pos = runner.clone().addScaledVector(fwd, Math.cos(ang) * 3.3).addScaledVector(right, Math.sin(ang) * 3.3).addScaledVector(tUp, 0.2 + Math.sin(this.t * 0.5) * 0.12);
      look = runner.clone().addScaledVector(tUp, 0.62); upV = new THREE.Vector3(0, 1, 0);
    } else if (this.shot === "respawn") {
      const k = Math.min(1, this.t / 0.9);
      pos.lerp(runner.clone().addScaledVector(tUp, 9).addScaledVector(fwd, -4), 1 - k);
      if (k >= 1) this.shot = "chase";
    }
    // ---- smooth it (snap on the very first frame)
    if (this.first) { this.pos.copy(pos); this.look.copy(look); this.up.copy(upV); this.first = false; }
    const kp = this.shot === "intro" || this.shot === "goal" ? 12 : 7 + Math.min(6, c.v * 0.2);
    this.pos.lerp(pos, damp(kp, dt)); this.look.lerp(look, damp(kp + 3, dt)); this.up.lerp(upV, damp(c.tag === "loop" ? 6 : 3, dt)).normalize();
    // ---- lens: wider with speed
    const base = c.portrait ? 70 : 58;
    const fovT = base + Math.min(14, fast * 0.7) + (c.rush ? 10 : 0) + wb * 6 + wf * 6 + this.modeFov;
    this.fov += (fovT - this.fov) * damp(3, dt);
    // ---- shake
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const sh = this.shake * this.shake * 0.35;
    const jitter = new THREE.Vector3(Math.sin(c.time * 37) * sh, Math.sin(c.time * 43 + 1) * sh, Math.sin(c.time * 29 + 2) * sh);
    // subtle hand-held sway even when calm
    const sway = new THREE.Vector3(Math.sin(c.time * 0.7) * 0.05, Math.sin(c.time * 0.9) * 0.04, 0);
    this.cam.position.copy(this.pos).add(jitter).add(sway);
    this.cam.up.copy(this.up);
    this.cam.lookAt(this.look);
    if (Math.abs(this.cam.fov - this.fov) > 0.01) { this.cam.fov = this.fov; this.cam.updateProjectionMatrix(); }
    void tr;
  }
}
