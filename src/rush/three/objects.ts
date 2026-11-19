// Everything on the track, in 3D and always moving: pearls that bob and glow, spinning Moon Medals, spike strips,
// hurdles and stone walls, striped log bars, crates and plank barricades, springs that squash and boing, dash pads
// with running chevrons, kicker ramps, floating ledges, Kranky's tin-toy Clankers (a Rollbot on a wheel with a
// turning wind-up key, a Hopper Tin on a spring, a Buzzdrone with spinning rotors), checkpoint lanterns, the moon goal
// arch, the pearl gate, the magnet bubble — and the two bosses, the Clank Crab and the Windmill Walker.
import * as THREE from "three";
import type { Track } from "../track";
import type { Obj } from "../types";
import { animateBossMore, animateMore, bossMore, buildMore } from "./objects2";
import { badge, chevrons, crate, glow, sparkle, stoneFloor, stripes } from "./tex";

export interface View { o: Obj; root: THREE.Object3D; parts: Record<string, THREE.Object3D>; t: number; hit: number }

const C = {
  pearl: "#FFE29A", tin: "#C9D2DE", tinDark: "#7C8899", red: "#E8504F", eye: "#FFFFFF", mint: "#5CF2C9", gold: "#FFC94A", wood: "#9A6A43", spring: "#FF6FAE",
};

export class ObjectArt {
  private geos = new Map<string, THREE.BufferGeometry>();
  private mats = new Map<string, THREE.Material>();
  private tmp = new Float32Array(12);
  readonly padTex: THREE.Texture;
  constructor(readonly tr: Track, readonly night: boolean) { this.padTex = chevrons().clone(); this.padTex.needsUpdate = true; this.padTex.repeat.set(1, 2); }
  g(k: string, f: () => THREE.BufferGeometry) { let x = this.geos.get(k); if (!x) { x = f(); this.geos.set(k, x); } return x; }
  m(k: string, f: () => THREE.Material) { let x = this.mats.get(k); if (!x) { x = f(); this.mats.set(k, x); } return x; }
  std(color: string, o: THREE.MeshStandardMaterialParameters = {}) { return this.m(`std:${color}:${JSON.stringify(o)}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...o })); }
  phys(color: string) { return this.m(`phys:${color}`, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.25, metalness: 0.55, clearcoat: 0.8 })); }
  add(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) { const me = new THREE.Mesh(geo, mat); me.position.set(x, y, z); me.castShadow = true; parent.add(me); return me; }
  glowAt(color: string, size: number, opacity: number, x: number, y: number, z: number) { const g = this.glowSprite(color, size, opacity); g.position.set(x, y, z); return g; }
  glowSprite(color: string, size: number, opacity = 1) {
    const s = new THREE.Sprite(this.m(`glowS:${color}:${opacity}`, () => new THREE.SpriteMaterial({ map: glow(color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity })) as THREE.SpriteMaterial);
    s.scale.setScalar(size); return s;
  }

  /** place an object's root on the track at (s, u, h): +y = track up, −z = forward */
  place(root: THREE.Object3D, s: number, u: number, h: number) {
    const fr = this.tr.frame(s, this.tmp);
    const P = [0, 0, 0]; this.tr.point(s, u, h, P);
    root.position.set(P[0], P[1], P[2]);
    root.up.set(fr[6], fr[7], fr[8]);
    root.lookAt(P[0] - fr[3], P[1] - fr[4], P[2] - fr[5]);
  }

  make(o: Obj): View | null {
    const root = new THREE.Group(); const parts: Record<string, THREE.Object3D> = {};
    const v: View = { o, root, parts, t: Math.random() * 10, hit: 0 };
    // Mayamma’s magics and the signature obstacles have their own looks
    const lk = o.look ?? "";
    if (((lk.startsWith("mg:") && o.k !== "zone") || lk.startsWith("sig:")) && buildMore(this, o, root, parts)) { root.traverse((x) => { (x as THREE.Mesh).castShadow = (x as THREE.Mesh).isMesh; }); return v; }
    switch (o.k) {
      case "pearl": case "bigPearl": {
        const r = o.k === "bigPearl" ? 0.42 : 0.26;
        const p = this.add(root, this.g("pearl", () => new THREE.IcosahedronGeometry(1, 2)), this.m("pearlMat", () => new THREE.MeshStandardMaterial({ color: C.pearl, emissive: "#FFB840", emissiveIntensity: 0.75, roughness: 0.15, metalness: 0.6 })));
        p.scale.setScalar(r); parts.core = p;
        const gl = this.glowSprite("#FFD27A", r * 5.5, 0.85); root.add(gl); parts.glow = gl;
        break;
      }
      case "medal": {
        const d = this.add(root, this.g("medal", () => new THREE.CylinderGeometry(0.42, 0.42, 0.08, 28).rotateX(Math.PI / 2)), this.m("medalMat", () => new THREE.MeshStandardMaterial({ color: "#E8EEFF", metalness: 0.9, roughness: 0.2, emissive: "#5A6AB0", emissiveIntensity: 0.4 })));
        const face = new THREE.Mesh(this.g("medalFace", () => new THREE.CircleGeometry(0.36, 24)), this.m("medalFace", () => new THREE.MeshBasicMaterial({ map: badge("🌙", "#2B3C8F"), transparent: true })));
        face.position.z = -0.05; face.rotation.y = Math.PI; d.add(face);
        const f2 = face.clone(); f2.position.z = 0.05; f2.rotation.y = 0; d.add(f2);
        parts.spin = d; root.add(this.glowSprite("#B8C8FF", 2.4, 0.7));
        break;
      }
      case "spike": {
        const w = (o.w ?? 1) * 2, len = (o.ds ?? 0.8) * 2;
        const base = this.add(root, this.g("spikeBase", () => new THREE.BoxGeometry(1, 0.12, 1)), this.std("#4A4F5E", { metalness: 0.6, roughness: 0.4 }), 0, 0.06, 0);
        base.scale.set(w, 1, len);
        const nx = Math.max(1, Math.round(w / 0.42)), nz = Math.max(1, Math.round(len / 0.5));
        const cone = this.g("spike", () => new THREE.ConeGeometry(0.17, 0.62, 8));
        const im = new THREE.InstancedMesh(cone, this.phys("#D9E0EA"), nx * nz);
        const ob = new THREE.Object3D(); let k = 0;
        for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { ob.position.set(-w / 2 + (i + 0.5) * (w / nx), 0.42, -len / 2 + (j + 0.5) * (len / nz)); ob.updateMatrix(); im.setMatrixAt(k++, ob.matrix); }
        im.castShadow = true; root.add(im);
        break;
      }
      case "wall": {
        const w = (o.w ?? 1) * 2, t = o.tall ?? 0.65;
        if (t < 1) {
          // a striped hurdle
          for (const sx of [-1, 1]) this.add(root, this.g("hPost", () => new THREE.BoxGeometry(0.18, 1, 0.18).translate(0, 0.5, 0)), this.std(C.wood), (sx * w) / 2 - sx * 0.1, 0, 0).scale.y = t;
          const bar = this.add(root, this.g("hBar", () => new THREE.BoxGeometry(1, 0.22, 0.14)), this.m("hBarM", () => new THREE.MeshStandardMaterial({ map: stripes("#FFFFFF", "#FF5A7A"), roughness: 0.5 })), 0, t - 0.12, 0);
          bar.scale.x = w;
          this.add(root, this.g("hBar", () => new THREE.BoxGeometry(1, 0.22, 0.14)), this.m("hBarM", () => new THREE.MeshStandardMaterial({ map: stripes("#FFFFFF", "#FF5A7A"), roughness: 0.5 })), 0, t * 0.45, 0).scale.x = w;
        } else {
          const wall = this.add(root, this.g("block", () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), this.m("wallM", () => new THREE.MeshStandardMaterial({ map: stoneFloor(), roughness: 0.9 })));
          wall.scale.set(w, t, (o.ds ?? 0.4) * 2);
          const moss = this.add(root, this.g("block", () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), this.std("#4FA35A", { roughness: 0.9 }), 0, t, 0);
          moss.scale.set(w + 0.1, 0.12, (o.ds ?? 0.4) * 2 + 0.1);
        }
        break;
      }
      case "bar": {
        const w = (o.w ?? 1) * 2;
        for (const sx of [-1, 1]) this.add(root, this.g("barPost", () => new THREE.CylinderGeometry(0.12, 0.14, 1.7, 8).translate(0, 0.85, 0)), this.std("#5A3E2A"), (sx * w) / 2, 0, 0);
        const log = this.add(root, this.g("log", () => new THREE.CylinderGeometry(0.26, 0.26, 1, 14).rotateZ(Math.PI / 2)), this.m("logM", () => new THREE.MeshStandardMaterial({ map: stripes("#FFE066", "#2B2B33"), roughness: 0.5 })), 0, 1.22, 0);
        log.scale.y = w; parts.log = log;
        root.add(this.glowAt("#FFD86B", 1.4, 0.5, 0, 1.22, 0));
        break;
      }
      case "crate": {
        if (o.p === 1) {
          // a plank barricade: only a Burst (or Turbo) breaks it
          const w = (o.w ?? 1) * 2, t = o.tall ?? 2.2;
          for (let i = 0; i < 4; i++) { const pl = this.add(root, this.g("plank", () => new THREE.BoxGeometry(1, 0.42, 0.16)), this.std(i % 2 ? "#A87648" : "#8E5F38"), 0, 0.3 + i * (t / 4), 0); pl.scale.x = w; pl.rotation.z = (i % 2 ? 1 : -1) * 0.03; }
          const sign = new THREE.Sprite(this.m("burstSign", () => new THREE.SpriteMaterial({ map: badge("⚡", "#FF5A7A"), transparent: true })) as THREE.SpriteMaterial); sign.position.y = t + 0.5; sign.scale.setScalar(1.1); root.add(sign); parts.sign = sign;
        } else {
          const c = this.add(root, this.g("crate", () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), this.m("crateM", () => new THREE.MeshStandardMaterial({ map: crate(), roughness: 0.75 })));
          c.scale.set((o.w ?? 0.6) * 2, o.tall ?? 1.1, (o.ds ?? 0.6) * 2);
        }
        break;
      }
      case "spring": case "trickRamp": {
        if (o.k === "trickRamp") {
          const w = (o.w ?? 2) * 2;
          const ramp = this.add(root, this.g("ramp", () => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(2.6, 0); sh.lineTo(2.6, 0.9); sh.quadraticCurveTo(1.2, 0.2, 0, 0); const e = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }); e.translate(-1.3, 0, -0.5); e.rotateY(Math.PI / 2); return e; }), this.m("rampM", () => new THREE.MeshStandardMaterial({ map: stripes("#FFFFFF", "#7A5CFF"), roughness: 0.5 })));
          ramp.scale.set(w, 1, 1);
          root.add(this.glowAt("#B89CFF", 3, 0.5, 0, 1, 0.8));
          break;
        }
        const base = this.add(root, this.g("springBase", () => new THREE.CylinderGeometry(0.62, 0.7, 0.18, 20)), this.std("#3A3F4E", { metalness: 0.5 }), 0, 0.09, 0);
        void base;
        const coil = new THREE.Group(); coil.position.y = 0.18; root.add(coil); parts.coil = coil;
        for (let i = 0; i < 4; i++) this.add(coil, this.g("coil", () => new THREE.TorusGeometry(0.38, 0.06, 8, 20).rotateX(Math.PI / 2)), this.phys("#E0E6EE"), 0, 0.08 + i * 0.14, 0);
        const pad = this.add(coil, this.g("springPad", () => new THREE.CylinderGeometry(0.62, 0.62, 0.16, 24)), this.std(C.spring, { roughness: 0.35, emissive: C.spring, emissiveIntensity: 0.3 }), 0, 0.7, 0);
        parts.pad = pad;
        root.add(this.glowAt("#FF8FC8", 2.2, 0.5, 0, 0.9, 0));
        break;
      }
      case "sideSpring": {
        const g = new THREE.Group(); g.rotation.z = (o.p ?? 9) > 0 ? -Math.PI / 2 : Math.PI / 2; g.position.y = 0.7; root.add(g);
        this.add(root, this.g("sPost", () => new THREE.BoxGeometry(0.3, 1.4, 0.3).translate(0, 0.7, 0)), this.std("#3A3F4E"), (o.p ?? 9) > 0 ? -0.35 : 0.35, 0, 0);
        const coil = new THREE.Group(); g.add(coil); parts.coil = coil;
        for (let i = 0; i < 3; i++) this.add(coil, this.g("coil", () => new THREE.TorusGeometry(0.38, 0.06, 8, 20).rotateX(Math.PI / 2)), this.phys("#E0E6EE"), 0, 0.1 + i * 0.14, 0);
        parts.pad = this.add(coil, this.g("springPad", () => new THREE.CylinderGeometry(0.62, 0.62, 0.16, 24)), this.std("#FFB347", { emissive: "#FFB347", emissiveIntensity: 0.35 }), 0, 0.5, 0);
        break;
      }
      case "pad": {
        const pad = new THREE.Mesh(this.g("pad", () => new THREE.PlaneGeometry(2.2, 3.4).rotateX(-Math.PI / 2)), this.m("padM", () => new THREE.MeshBasicMaterial({ map: this.padTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: "#7DFFE0" })));
        pad.position.y = 0.05; root.add(pad);
        const frame = new THREE.Mesh(this.g("padFrame", () => new THREE.PlaneGeometry(2.5, 3.7).rotateX(-Math.PI / 2)), this.std("#1D3B4A", { emissive: "#0E5A60", emissiveIntensity: 0.6 }));
        frame.position.y = 0.03; root.add(frame);
        break;
      }
      case "platform": {
        const len = (o.ds ?? 10) * 2, w = (o.w ?? 1.8) * 2, t = o.tall ?? 0.6;
        const slab = this.add(root, this.g("block", () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), this.m("wallM", () => new THREE.MeshStandardMaterial({ map: stoneFloor(), roughness: 0.9 })), 0, -t, 0);
        slab.scale.set(w, t, len);
        const top = this.add(root, this.g("block", () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), this.std("#5CB85C", { roughness: 0.9 }), 0, -0.05, 0);
        top.scale.set(w + 0.1, 0.12, len);
        for (let z = -len / 2 + 2; z < len / 2; z += 9) this.add(root, this.g("legP", () => new THREE.CylinderGeometry(0.16, 0.2, 1, 8).translate(0, -0.5, 0)), this.std("#7A6A5A"), 0, -t, z).scale.y = Math.max(0.5, o.h - t);
        break;
      }
      case "rollbot": {
        const body = new THREE.Group(); body.position.y = 0.55; root.add(body); parts.body = body;
        this.add(body, this.g("can", () => new THREE.CylinderGeometry(0.36, 0.36, 0.62, 20)), this.phys(C.tin));
        this.add(body, this.g("canBand", () => new THREE.CylinderGeometry(0.375, 0.375, 0.16, 20)), this.std(C.red, { roughness: 0.35 }), 0, 0.06, 0);
        this.eyes(body, 0.12, -0.33, 0.1);
        const key = new THREE.Group(); key.position.set(0, 0.05, 0.38); body.add(key); parts.key = key;
        this.add(key, this.g("keyStem", () => new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8).rotateX(Math.PI / 2)), this.phys(C.gold), 0, 0, 0.1);
        this.add(key, this.g("keyWing", () => new THREE.TorusGeometry(0.1, 0.035, 8, 14)), this.phys(C.gold), 0.12, 0, 0.2).rotation.y = Math.PI / 2;
        this.add(key, this.g("keyWing", () => new THREE.TorusGeometry(0.1, 0.035, 8, 14)), this.phys(C.gold), -0.12, 0, 0.2).rotation.y = Math.PI / 2;
        const wheel = this.add(root, this.g("wheel", () => new THREE.TorusGeometry(0.22, 0.09, 10, 20).rotateY(Math.PI / 2)), this.std("#2E2A33", { roughness: 0.7 }), 0, 0.24, 0);
        parts.wheel = wheel;
        break;
      }
      case "hopper": {
        const body = new THREE.Group(); root.add(body); parts.body = body;
        const can = new THREE.Group(); can.position.y = 0.95; body.add(can); parts.can = can;
        this.add(can, this.g("can", () => new THREE.CylinderGeometry(0.36, 0.36, 0.62, 20)), this.phys("#9FD0FF"));
        this.add(can, this.g("canBand", () => new THREE.CylinderGeometry(0.375, 0.375, 0.16, 20)), this.std("#3A6AF0", { roughness: 0.35 }), 0, -0.1, 0);
        this.eyes(can, 0.12, -0.33, 0.1);
        const coil = new THREE.Group(); coil.position.y = 0.1; body.add(coil); parts.coil = coil;
        for (let i = 0; i < 5; i++) this.add(coil, this.g("smallCoil", () => new THREE.TorusGeometry(0.18, 0.04, 6, 14).rotateX(Math.PI / 2)), this.phys("#E0E6EE"), 0, i * 0.13, 0);
        break;
      }
      case "drone": {
        const body = new THREE.Group(); root.add(body); parts.body = body;
        this.add(body, this.g("droneCan", () => new THREE.SphereGeometry(0.38, 18, 14)), this.phys("#FFD15A"));
        this.add(body, this.g("canBand", () => new THREE.CylinderGeometry(0.375, 0.375, 0.16, 20)), this.std("#2E2A33"), 0, 0, 0).scale.set(1.02, 1, 1.02);
        this.eyes(body, 0.1, -0.33, 0.08);
        const rot = new THREE.Group(); rot.position.y = 0.48; body.add(rot); parts.rotor = rot;
        this.add(body, this.g("mast", () => new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6)), this.std("#2E2A33"), 0, 0.38, 0);
        for (let i = 0; i < 3; i++) { const b = this.add(rot, this.g("blade", () => new THREE.BoxGeometry(0.9, 0.02, 0.12).translate(0.45, 0, 0)), this.std("#2E2A33")); b.rotation.y = (i / 3) * Math.PI * 2; }
        break;
      }
      case "lamp": {
        this.add(root, this.g("chkPost", () => new THREE.CylinderGeometry(0.1, 0.13, 3.2, 8).translate(0, 1.6, 0)), this.std("#2E2A33"), 0, 0, 0).position.x = 0;
        const arch = this.add(root, this.g("chkArch", () => new THREE.TorusGeometry(4.6, 0.14, 8, 32, Math.PI)), this.std("#2E2A33", { metalness: 0.6 }), 0, 0, 0);
        arch.position.y = 0.2; parts.arch = arch;
        const bulb = this.add(root, this.g("bulb", () => new THREE.SphereGeometry(0.3, 14, 10)), this.m("bulbOff", () => new THREE.MeshBasicMaterial({ color: "#7A8AC0" })), 0, 4.75, 0);
        parts.bulb = bulb;
        const gl = this.glowSprite("#9FB8FF", 3, 0.6); gl.position.y = 4.75; root.add(gl); parts.glow = gl;
        break;
      }
      case "goal": {
        const ring = this.add(root, this.g("goalRing", () => new THREE.TorusGeometry(5.4, 0.42, 14, 48, Math.PI)), this.m("goalM", () => new THREE.MeshStandardMaterial({ color: "#FFE9A8", emissive: "#FFB840", emissiveIntensity: 0.8, metalness: 0.5, roughness: 0.3 })));
        parts.ring = ring;
        const moonS = new THREE.Sprite(this.m("goalMoon", () => new THREE.SpriteMaterial({ map: badge("🌙", "#2B3C8F"), transparent: true })) as THREE.SpriteMaterial);
        moonS.position.y = 6.4; moonS.scale.setScalar(2.4); root.add(moonS); parts.moon = moonS;
        const gl = this.glowSprite("#FFD27A", 16, 0.55); gl.position.y = 3.5; root.add(gl); parts.glow = gl;
        const line = new THREE.Mesh(this.g("goalLine", () => new THREE.PlaneGeometry(10.8, 1.2).rotateX(-Math.PI / 2)), this.m("goalLineM", () => new THREE.MeshBasicMaterial({ map: stripes("#FFFFFF", "#2B2B33"), transparent: true, opacity: 0.9 })));
        line.position.y = 0.04; root.add(line);
        break;
      }
      case "pearlGate": {
        const ring = this.add(root, this.g("gateRing", () => new THREE.TorusGeometry(4.8, 0.3, 12, 40, Math.PI)), this.std("#7A5CFF", { emissive: "#4A2AFF", emissiveIntensity: 0.7 }));
        parts.ring = ring;
        const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: badge(String(o.p ?? 0), "#7A5CFF"), transparent: true })); sign.position.y = 5.6; sign.scale.setScalar(2.2); root.add(sign);
        break;
      }
      case "magnet": {
        const bub = new THREE.Sprite(this.m("magnetS", () => new THREE.SpriteMaterial({ map: badge("🧲", "rgba(120,200,255,0.35)"), transparent: true })) as THREE.SpriteMaterial);
        bub.scale.setScalar(1.3); root.add(bub); parts.spin = bub;
        root.add(this.glowSprite("#8FD6FF", 3, 0.6));
        break;
      }
      default: if (!buildMore(this, o, root, parts)) return null;
    }
    root.traverse((x) => { (x as THREE.Mesh).castShadow = (x as THREE.Mesh).isMesh; });
    return v;
  }

  eyes(parent: THREE.Object3D, y: number, z: number, x: number) {
    for (const sx of [-1, 1]) {
      this.add(parent, this.g("eyeW", () => new THREE.SphereGeometry(0.09, 12, 10)), this.std("#FFFFFF", { roughness: 0.2 }), sx * x, y, z);
      this.add(parent, this.g("eyeP", () => new THREE.SphereGeometry(0.045, 10, 8)), this.std("#1A1420"), sx * x, y, z - 0.07);
      const brow = this.add(parent, this.g("brow", () => new THREE.BoxGeometry(0.14, 0.03, 0.03)), this.std("#1A1420"), sx * x, y + 0.11, z - 0.04);
      brow.rotation.z = sx * 0.4;
    }
  }

  /** animate a view this frame (sOf/hOf give the moving position from the sim) */
  animate(v: View, dt: number, t: number, u: number, h: number, on = true) {
    const o = v.o, p = v.parts;
    v.t += dt;
    if (v.root.userData.custom) { animateMore(v, dt, t, on); if (p.shadow) { p.shadow.position.y = -h + 0.03; p.shadow.scale.setScalar(Math.max(0.4, 1.2 - h * 0.06)); } return; }
    switch (o.k) {
      case "pearl": case "bigPearl": { const b = Math.sin(t * 3 + o.s * 0.4) * 0.12; p.core.position.y = b; p.glow.position.y = b; (p.glow as THREE.Sprite).material.rotation = t; p.core.rotation.y = t * 2; break; }
      case "medal": p.spin.rotation.y = t * 2.4; p.spin.position.y = Math.sin(t * 2) * 0.12; break;
      case "magnet": p.spin.position.y = Math.sin(t * 2.4) * 0.15; break;
      case "spring": case "sideSpring": if (p.coil) { v.hit = Math.max(0, v.hit - dt * 3); const k = 1 - Math.sin(v.hit * Math.PI) * 0.45; p.coil.scale.y = k * (1 + Math.sin(t * 5) * 0.03); } break;
      case "rollbot": p.wheel.rotation.x -= dt * 9; p.key.rotation.z += dt * 4; p.body.rotation.z = Math.sin(t * 9) * 0.08; p.body.position.y = 0.55 + Math.abs(Math.sin(t * 9)) * 0.04; break;
      case "hopper": { p.can.position.y = 0.95 + 0; p.coil.scale.y = 1 + Math.sin(t * 8) * 0.06; p.body.rotation.y = Math.sin(t * 1.5) * 0.3; break; }
      case "drone": p.rotor.rotation.y += dt * 30; p.body.position.y = Math.sin(t * 3) * 0.08; p.body.rotation.z = Math.sin(t * 2) * 0.12; break;
      case "lamp": if (p.glow) (p.glow as THREE.Sprite).scale.setScalar(3 + Math.sin(t * 4) * 0.2); break;
      case "goal": (p.glow as THREE.Sprite).material.opacity = 0.45 + Math.sin(t * 3) * 0.15; p.moon.position.y = 6.4 + Math.sin(t * 2) * 0.15; break;
      case "bar": p.log.rotation.x = Math.sin(t * 2) * 0.05; break;
      default: animateMore(v, dt, t, on); break;
    }
    // falling things cast their shadow on the track below them
    if (p.shadow) { p.shadow.position.y = -h + 0.03; p.shadow.scale.setScalar(Math.max(0.4, 1.2 - h * 0.06)); }
    void u;
  }
  /** a checkpoint lantern lights up */
  light(v: View) {
    const b = v.parts.bulb as THREE.Mesh | undefined;
    if (b) b.material = this.m("bulbOn", () => new THREE.MeshBasicMaterial({ color: "#FFE08A" }));
    const g = v.parts.glow as THREE.Sprite | undefined;
    if (g) g.material = this.m("glowOn", () => new THREE.SpriteMaterial({ map: glow("#FFC46B"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 1 })) as THREE.SpriteMaterial;
  }
  frame(dt: number) { this.padTex.offset.y -= dt * 2.2; }

  // ---------------------------------------------------------------- bosses
  boss(kind: string): { root: THREE.Group; parts: Record<string, THREE.Object3D> } {
    if (kind !== "crab" && kind !== "windmill") return bossMore(this, kind);
    const root = new THREE.Group(), parts: Record<string, THREE.Object3D> = {};
    if (kind === "crab") {
      const body = new THREE.Group(); body.position.y = 2.1; root.add(body); parts.body = body;
      const shell = this.add(body, this.g("crabShell", () => new THREE.SphereGeometry(1.6, 28, 18)), this.phys("#E8604F")); shell.scale.set(1.5, 0.75, 1.1);
      this.add(body, this.g("crabBelly", () => new THREE.SphereGeometry(1.2, 24, 14)), this.std("#FFD2A0", { emissive: "#FF8A3A", emissiveIntensity: 0.2 }), 0, -0.45, -0.6).scale.set(1.3, 0.55, 0.7);
      const belly = this.add(body, this.g("weak", () => new THREE.SphereGeometry(0.6, 18, 12)), this.std("#7DFFE0", { emissive: "#3AFFC8", emissiveIntensity: 1.2 }), 0, -0.55, -1.25);
      parts.weak = belly;
      for (const sx of [-1, 1]) {
        const stalk = this.add(body, this.g("stalk", () => new THREE.CylinderGeometry(0.1, 0.12, 0.9, 8)), this.phys(C.tin), sx * 0.6, 1.25, -0.6);
        void stalk;
        this.add(body, this.g("bigEye", () => new THREE.SphereGeometry(0.32, 16, 12)), this.std("#FFFFFF", { roughness: 0.2 }), sx * 0.6, 1.8, -0.6);
        this.add(body, this.g("bigPupil", () => new THREE.SphereGeometry(0.15, 12, 10)), this.std("#1A1420"), sx * 0.6, 1.8, -0.88);
        const arm = new THREE.Group(); arm.position.set(sx * 2.2, 0.2, -0.6); body.add(arm); parts[`arm${sx}`] = arm;
        this.add(arm, this.g("crabArm", () => new THREE.CylinderGeometry(0.22, 0.26, 1.6, 10).rotateZ(Math.PI / 2)), this.phys("#E8604F"), sx * 0.6, 0, 0);
        const claw = new THREE.Group(); claw.position.set(sx * 1.5, 0.3, -0.4); arm.add(claw); parts[`claw${sx}`] = claw;
        this.add(claw, this.g("claw", () => new THREE.SphereGeometry(0.7, 16, 12)), this.phys("#FF7A5A")).scale.set(0.8, 1.2, 0.7);
        const pin = this.add(claw, this.g("pincer", () => new THREE.ConeGeometry(0.28, 1.1, 10)), this.phys("#FF7A5A"), 0, 0.9, -0.2); pin.rotation.x = -0.4; parts[`pin${sx}`] = pin;
        for (let k = 0; k < 3; k++) { const leg = this.add(root, this.g("crabLeg", () => new THREE.CylinderGeometry(0.1, 0.06, 2.2, 6)), this.phys(C.tinDark), sx * (1.6 + k * 0.2), 1.1, -0.2 + k * 0.6); leg.rotation.z = sx * 0.6; parts[`leg${sx}${k}`] = leg; }
      }
      const keyG = new THREE.Group(); keyG.position.set(0, 1.0, 1.6); body.add(keyG); parts.key = keyG;
      this.add(keyG, this.g("bkStem", () => new THREE.CylinderGeometry(0.12, 0.12, 0.8, 10).rotateX(Math.PI / 2)), this.phys(C.gold), 0, 0, 0.3);
      for (const sx of [-1, 1]) this.add(keyG, this.g("bkWing", () => new THREE.TorusGeometry(0.4, 0.12, 8, 16)), this.phys(C.gold), sx * 0.45, 0, 0.7).rotation.y = Math.PI / 2;
    } else {
      const body = new THREE.Group(); root.add(body); parts.body = body;
      this.add(body, this.g("millTower", () => new THREE.CylinderGeometry(1.4, 2.0, 6, 14)), this.std("#F2E6D0", { roughness: 0.7 }), 0, 4.4, 0);
      this.add(body, this.g("millRoof", () => new THREE.ConeGeometry(1.9, 2.2, 14)), this.std("#C8553D"), 0, 8.5, 0);
      this.add(body, this.g("millCore", () => new THREE.SphereGeometry(0.75, 18, 12)), this.std("#7DFFE0", { emissive: "#3AFFC8", emissiveIntensity: 1.3 }), 0, 4.6, -1.5);
      parts.weak = body.children[body.children.length - 1];
      for (const sx of [-1, 1]) this.add(body, this.g("bigEye", () => new THREE.SphereGeometry(0.32, 16, 12)), this.std("#FFFFFF", { roughness: 0.2 }), sx * 0.55, 6.4, -1.3);
      for (const sx of [-1, 1]) this.add(body, this.g("bigPupil", () => new THREE.SphereGeometry(0.15, 12, 10)), this.std("#1A1420"), sx * 0.55, 6.4, -1.58);
      const hub = new THREE.Group(); hub.position.set(0, 6.6, -1.8); body.add(hub); parts.hub = hub;
      for (let i = 0; i < 4; i++) { const arm = new THREE.Group(); arm.rotation.z = (i / 4) * Math.PI * 2; hub.add(arm); const b = this.add(arm, this.g("millBlade", () => new THREE.BoxGeometry(1.1, 4.8, 0.1).translate(0, 2.6, 0)), this.std("#FFF8EA", { roughness: 0.8 })); void b; }
      for (const sx of [-1, 1]) { const leg = new THREE.Group(); leg.position.set(sx * 1.1, 1.4, 0); body.add(leg); parts[`leg${sx}`] = leg; this.add(leg, this.g("millLeg", () => new THREE.CylinderGeometry(0.3, 0.4, 2.8, 10).translate(0, -1.4, 0)), this.phys(C.tinDark)); this.add(leg, this.g("millFoot", () => new THREE.BoxGeometry(1, 0.4, 1.4)), this.phys("#3A3F4E"), 0, -2.8, -0.2); }
    }
    root.add(this.glowAt("#FF8A5A", 10, 0.25, 0, 3, 0));
    root.traverse((x) => { (x as THREE.Mesh).castShadow = (x as THREE.Mesh).isMesh; });
    return { root, parts };
  }
  animateBoss(kind: string, parts: Record<string, THREE.Object3D>, t: number, mood: "attack" | "tired" | "hit" | "down" | "intro" | "recover") {
    if (kind !== "crab" && kind !== "windmill") { animateBossMore(kind, parts, t, mood); return; }
    const tired = mood === "tired";
    if (kind === "crab") {
      parts.body.position.y = 2.1 + (tired ? -0.8 : Math.abs(Math.sin(t * 6)) * 0.15);
      parts.body.rotation.z = tired ? Math.sin(t * 3) * 0.1 : Math.sin(t * 6) * 0.05;
      for (const sx of [-1, 1]) {
        parts[`arm${sx}`].rotation.z = tired ? sx * 0.6 : sx * (0.2 + Math.sin(t * 4 + sx) * 0.35);
        parts[`pin${sx}`].rotation.x = -0.4 + Math.sin(t * 10) * 0.3;
        for (let k = 0; k < 3; k++) parts[`leg${sx}${k}`].rotation.x = Math.sin(t * 12 + k * 2) * 0.4;
      }
      parts.key.rotation.z += 0.05;
    } else {
      parts.hub.rotation.z += tired ? 0.01 : 0.12;
      for (const sx of [-1, 1]) parts[`leg${sx}`].rotation.x = tired ? 0 : Math.sin(t * 5 + (sx > 0 ? Math.PI : 0)) * 0.5;
      parts.body.position.y = tired ? -0.8 : Math.abs(Math.sin(t * 5)) * 0.3;
    }
    const w = parts.weak as THREE.Mesh | undefined;
    if (w) w.scale.setScalar(tired ? 1.25 + Math.sin(t * 12) * 0.15 : 0.9);
  }
  /** spark particles use this texture */
  sparkTex() { return sparkle(); }
  dispose() { for (const g of this.geos.values()) g.dispose(); for (const m of this.mats.values()) m.dispose(); this.padTex.dispose(); }
}
