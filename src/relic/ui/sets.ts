// Bubble Relics 3D sets: the room behind the bubble wall, built in three.js from the chamber and the stage number, so
// every stage stands in a different place. A set is a hall running away from you into the distance (floor, side
// walls, arches or columns, a lit doorway at the far end, fog), dressed by its chamber:
//   jungle  — mossy ruins open to a green sky, hanging vines, ferns
//   torch   — a stone corridor of arches with torches on every pillar
//   serpent — green-fire shrine, coiled stone serpents on the columns
//   crystal — a cave of rough rock lit by glowing crystal clusters
//   sunken  — a flooded hall: a rippling water floor, light shafts, rising bubbles
//   gold    — a vault of gold tiles, treasure piles and chests
//   moon    — an open-air altar under the stars and a huge moon, broken columns, steps
//   dragon  — a lava-floored sanctum with horned statues and rising embers
// The stage number seeds the layout (corridor / wide hall / stairs), its length, how many arches, column style, wall
// width, prop placement and a small light-colour shift. Units are CSS px in the z = 0 plane (the bubble wall); the
// camera sits at z ≈ 1.87·H, the hall runs to z ≈ −3·H.
import * as THREE from "three";
import { rngFrom } from "../../sudoku/rng";
import type { Realm } from "../stage";

export interface SetHandle { group: THREE.Group; fog: THREE.Fog; update: (t: number, dt: number) => void; dispose: () => void }

type Style = "moss" | "brick" | "snake" | "rock" | "sea" | "gold" | "marble" | "basalt";
const STYLE: Record<string, Style> = { jungle: "moss", torch: "brick", serpent: "snake", crystal: "rock", sunken: "sea", gold: "gold", moon: "marble", dragon: "basalt" };

export function buildSet(o: { realm: Realm; stage: number; W: number; H: number; s: number }): SetHandle {
  const { realm, stage, W, H, s } = o;
  const rng = rngFrom(`relic-set:${stage}`);
  const style = STYLE[realm.id] ?? "brick";
  const group = new THREE.Group();
  const trash: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(x: T) => { trash.push(x); return x; };
  const animators: ((t: number, dt: number) => void)[] = [];

  // ---------------------------------------------------------------- layout from the stage
  const layout = (["corridor", "hall", "stairs"] as const)[rng.int(3)];
  const wide = layout === "hall" ? 1.35 + rng.next() * 0.25 : 0.95 + rng.next() * 0.25;
  const hw = (W / 2) * wide + s * 1.5;               // half width of the room at the walls
  const fy = -H / 2 + s * 0.4;                        // floor height
  const ceil = H / 2 + s * (2 + rng.next() * 3);      // ceiling height
  const L = H * (2.6 + rng.next() * 0.9);             // how far it runs
  const z0 = -s * 2.5, z1 = z0 - L;
  const nArch = 3 + rng.int(4);
  const colRound = rng.next() < 0.5;
  const glow = new THREE.Color(realm.glow).offsetHSL((rng.next() - 0.5) * 0.1, 0, (rng.next() - 0.5) * 0.1);
  const base = new THREE.Color(realm.stone).offsetHSL((rng.next() - 0.5) * 0.06, (rng.next() - 0.5) * 0.1, (rng.next() - 0.5) * 0.12);
  const fogC = new THREE.Color(realm.sky[0]).lerp(glow, 0.08);
  const camZ = H / 2 / Math.tan(THREE.MathUtils.degToRad(15));
  const fog = new THREE.Fog(fogC, camZ + H * 0.6, camZ + L * 1.05);

  // ---------------------------------------------------------------- surfaces
  const wallTex = keep(surfaceTex(style, base, rng.int(1e6)));
  wallTex.repeat.set(L / 260, (ceil - fy) / 260);
  const floorTex = keep(surfaceTex(style === "moss" ? "moss" : style === "sea" ? "sea" : style === "basalt" ? "basalt" : style === "gold" ? "gold" : "brick", base.clone().multiplyScalar(0.85), rng.int(1e6), true));
  floorTex.repeat.set((hw * 2) / 220, L / 220);
  const wallMat = keep(new THREE.MeshStandardMaterial({ map: wallTex, color: style === "gold" ? "#d8b060" : "#ffffff", roughness: style === "gold" ? 0.45 : 0.9, metalness: style === "gold" ? 0.55 : 0 }));
  const floorMat = keep(new THREE.MeshStandardMaterial({ map: floorTex, roughness: style === "sea" ? 0.15 : 0.85, metalness: style === "sea" ? 0.3 : style === "gold" ? 0.4 : 0, emissive: style === "basalt" ? new THREE.Color("#ff4a10") : new THREE.Color(0), emissiveMap: style === "basalt" ? floorTex : null, emissiveIntensity: style === "basalt" ? 0.9 : 0 }));
  const stoneMat = keep(new THREE.MeshStandardMaterial({ color: style === "gold" ? "#e0b44a" : base.clone().lerp(new THREE.Color("#ffffff"), 0.15), roughness: style === "gold" ? 0.35 : 0.8, metalness: style === "gold" ? 0.7 : 0, map: style === "gold" ? null : wallTex }));

  const plane = (w: number, h: number, m: THREE.Material) => new THREE.Mesh(keep(new THREE.PlaneGeometry(w, h)), m);
  // floor (stairs: a few broad steps rising toward the far end)
  if (layout === "stairs") {
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      const d = L / steps, y = fy + i * s * 0.9;
      const st = new THREE.Mesh(keep(new THREE.BoxGeometry(hw * 2, s * 0.9 * (i + 1), d)), floorMat);
      st.position.set(0, fy - s * 0.45 * (i + 1) + y - fy + s * 0.45 * i, z0 - d * (i + 0.5));
      group.add(st);
    }
  } else {
    const f = plane(hw * 2, L, floorMat); f.rotation.x = -Math.PI / 2; f.position.set(0, fy, z0 - L / 2); group.add(f);
  }
  // side walls and the ceiling (the moon altar and the jungle ruins are open to the sky)
  const open = style === "marble" || style === "moss";
  for (const side of [-1, 1]) {
    const w = plane(L, (open ? H * 0.55 : ceil - fy), wallMat);
    w.rotation.y = -side * Math.PI / 2;
    w.position.set(side * hw, fy + (open ? H * 0.55 : ceil - fy) / 2, z0 - L / 2);
    group.add(w);
  }
  if (!open) { const c = plane(hw * 2, L, wallMat); c.rotation.x = Math.PI / 2; c.position.set(0, ceil, z0 - L / 2); group.add(c); }
  // the far wall with a glowing doorway
  const back = plane(hw * 2.4, (ceil - fy) * 1.4, wallMat); back.position.set(0, fy + (ceil - fy) * 0.6, z1); group.add(back);
  const doorTex = keep(glowTex());
  const door = new THREE.Mesh(keep(new THREE.PlaneGeometry(hw * 0.7, H * 0.75)), keep(new THREE.MeshBasicMaterial({ map: doorTex, color: glow, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
  door.position.set(0, fy + H * 0.3, z1 + 2); group.add(door);

  // ---------------------------------------------------------------- the sky for open sets
  if (open) {
    const skyTex = keep(skyTexFor(style, realm, rng.int(1e6)));
    const sky = new THREE.Mesh(keep(new THREE.PlaneGeometry(hw * 7, H * 5)), keep(new THREE.MeshBasicMaterial({ map: skyTex, fog: false })));
    sky.position.set(0, fy + H * 1.6, z1 - s * 10); group.add(sky);
    if (style === "marble") {
      const moon = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: keep(moonTex()), color: "#fff6e0", fog: false })));
      moon.scale.set(H * 0.9, H * 0.9, 1); moon.position.set((rng.next() - 0.5) * hw * 1.2, fy + H * 1.55, z1 - s * 8); group.add(moon);
    }
  }

  // ---------------------------------------------------------------- arches / columns, with torches or crystals
  const colGeo = keep(colRound ? new THREE.CylinderGeometry(s * 0.9, s * 1.05, 1, 16) : new THREE.BoxGeometry(s * 1.8, 1, s * 1.8));
  const flameTex = keep(flameTexture()), haloTex = doorTex;
  const lights: THREE.PointLight[] = [];
  const flames: { sp: THREE.Sprite; halo: THREE.Sprite; ph: number; light?: THREE.PointLight }[] = [];
  const torchCol = style === "snake" ? new THREE.Color("#5dff8a") : glow;
  const addTorch = (x: number, y: number, z: number, side: number) => {
    const bracket = new THREE.Mesh(keep(new THREE.CylinderGeometry(s * 0.12, s * 0.2, s * 1.1, 8)), keep(new THREE.MeshStandardMaterial({ color: "#6a4a2a", metalness: 0.6, roughness: 0.4 })));
    bracket.position.set(x - side * s * 0.4, y, z); bracket.rotation.z = side * 0.35; group.add(bracket);
    const sp = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: flameTex, color: torchCol, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    sp.scale.set(s * 1.2, s * 1.9, 1); sp.position.set(x - side * s * 0.6, y + s * 1.1, z);
    const halo = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: haloTex, color: torchCol, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })));
    halo.scale.set(s * 8, s * 8, 1); halo.position.set(x - side * s * 0.6, y + s * 0.9, z - 1);
    group.add(sp, halo);
    let light: THREE.PointLight | undefined;
    if (lights.length < 4) { light = new THREE.PointLight(torchCol, 2.4, H * 1.1, 1.3); light.position.set(x - side * s * 1.5, y + s * 1.2, z + s * 2); group.add(light); lights.push(light); }
    flames.push({ sp, halo, ph: rng.next() * 6, light });
  };
  const archMat = stoneMat;
  for (let i = 0; i < nArch; i++) {
    const z = z0 - (L * (i + 0.6)) / (nArch + 0.4);
    const stepY = layout === "stairs" ? Math.floor(((z0 - z) / L) * 6) * s * 0.9 : 0;
    const broken = style === "marble" && rng.next() < 0.4;
    for (const side of [-1, 1]) {
      const hgt = (broken && side === (rng.next() < 0.5 ? -1 : 1) ? 0.45 : 1) * (open ? H * 0.75 : ceil - fy);
      const col = new THREE.Mesh(colGeo, archMat);
      col.scale.y = hgt; col.position.set(side * (hw - s * 1.0), fy + stepY + hgt / 2, z);
      group.add(col);
      // a carved capital
      const cap = new THREE.Mesh(keep(new THREE.BoxGeometry(s * 2.6, s * 0.7, s * 2.6)), archMat);
      cap.position.set(side * (hw - s * 1.0), fy + stepY + hgt, z); group.add(cap);
      if (style === "snake") {
        // a stone serpent coiled around the column
        for (let k = 0; k < 3; k++) {
          const coil = new THREE.Mesh(keep(new THREE.TorusGeometry(s * 1.25, s * 0.32, 8, 20, Math.PI * 1.6)), keep(new THREE.MeshStandardMaterial({ color: "#3f8a5a", roughness: 0.5, metalness: 0.2 })));
          coil.rotation.set(Math.PI / 2 + 0.25, 0, k * 1.2); coil.position.set(side * (hw - s * 1.0), fy + stepY + hgt * (0.25 + k * 0.22), z);
          group.add(coil);
        }
      }
      if (style !== "rock" && style !== "sea" && (style !== "marble" || !broken)) addTorch(side * (hw - s * 2.0), fy + stepY + Math.min(hgt * 0.55, H * 0.45), z + s * 1.2, side);
    }
    // the arch over the hall
    if (!open) {
      const arch = new THREE.Mesh(keep(new THREE.TorusGeometry(hw - s * 1.0, s * 0.8, 8, 32, Math.PI)), archMat);
      arch.position.set(0, ceil - (hw - s * 1.0) * 0.55 + stepY, z); arch.scale.y = 0.55; group.add(arch);
    }
  }

  // ---------------------------------------------------------------- chamber dressing
  if (style === "moss") {
    // hanging vines along the walls and ferns on the floor
    const vineMat = keep(new THREE.MeshStandardMaterial({ color: "#3f8a32", roughness: 0.7 }));
    const leafMat = keep(new THREE.MeshStandardMaterial({ color: "#5fcf4a", roughness: 0.6 }));
    const vineGeo = keep(new THREE.CylinderGeometry(s * 0.12, s * 0.12, 1, 5));
    const leafGeo = keep(new THREE.SphereGeometry(1, 8, 6));
    for (let i = 0; i < 14; i++) {
      const side = i % 2 ? 1 : -1, z = z0 - rng.next() * L * 0.9, len = H * (0.2 + rng.next() * 0.35);
      const v = new THREE.Mesh(vineGeo, vineMat); v.scale.y = len; v.position.set(side * (hw - s * 0.4), fy + H * 0.55 - len / 2, z); group.add(v);
      for (let k = 0; k < 4; k++) { const lf = new THREE.Mesh(leafGeo, leafMat); lf.scale.set(s * 0.6, s * 0.22, s * 0.3); lf.position.set(side * (hw - s * 0.8), fy + H * 0.55 - len * (k + 0.5) / 4, z); lf.rotation.z = side * 0.6; group.add(lf); }
    }
    for (let i = 0; i < 10; i++) {
      const side = i % 2 ? 1 : -1, z = z0 - s * 4 - rng.next() * L * 0.8;
      for (let k = 0; k < 5; k++) { const lf = new THREE.Mesh(leafGeo, leafMat); lf.scale.set(s * 1.4, s * 0.25, s * 0.5); lf.position.set(side * (hw - s * 3 - rng.next() * s * 4), fy + s * 0.4, z); lf.rotation.set(0, k * 1.2, side * 0.5); group.add(lf); }
    }
  }
  if (style === "rock") {
    // crystal clusters: glowing hexagonal spikes on walls and floor, the cave's only light
    const crGeo = keep(new THREE.ConeGeometry(s * 0.7, 1, 6));
    const crMat = keep(new THREE.MeshStandardMaterial({ color: glow, emissive: glow, emissiveIntensity: 1.2, roughness: 0.2, transparent: true, opacity: 0.9 }));
    const n = 26, inst = new THREE.InstancedMesh(crGeo, crMat, n * 3);
    let k = 0; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < n; i++) {
      const side = rng.next() < 0.5 ? -1 : 1, z = z0 - rng.next() * L * 0.95;
      const onWall = rng.next() < 0.5, x = onWall ? side * hw : side * (hw - s * (2 + rng.next() * 6)), y = onWall ? fy + rng.next() * H * 0.7 : fy;
      for (let c = 0; c < 3; c++) {
        const len = s * (1.5 + rng.next() * 3.5);
        e.set((rng.next() - 0.5) * 0.9, 0, onWall ? -side * (Math.PI / 2 - 0.4 + rng.next() * 0.8) : (rng.next() - 0.5) * 0.9);
        q.setFromEuler(e);
        m4.compose(new THREE.Vector3(x, y + (onWall ? 0 : len / 2), z + (c - 1) * s), q, new THREE.Vector3(1, len, 1));
        inst.setMatrixAt(k++, m4);
      }
      if (lights.length < 4 && i % 7 === 0) { const l = new THREE.PointLight(glow, 2.2, H * 1.2, 1.3); l.position.set(x * 0.8, y + s * 3, z); group.add(l); lights.push(l); }
    }
    inst.count = k; group.add(inst);
    animators.push((t) => { crMat.emissiveIntensity = 1.0 + Math.sin(t * 1.3) * 0.3; });
  }
  if (style === "sea") {
    // light shafts from above and rising bubbles; the water floor ripples
    const shaftMat = keep(new THREE.MeshBasicMaterial({ map: doorTex, color: "#9ff4ff", transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
    for (let i = 0; i < 5; i++) { const sh = plane(s * 6, H * 1.6, shaftMat); sh.position.set((rng.next() - 0.5) * hw * 1.4, fy + H * 0.6, z0 - rng.next() * L * 0.8); sh.rotation.z = 0.25; group.add(sh); }
    const bubTex = keep(bubbleTex());
    const bubs: THREE.Sprite[] = [];
    for (let i = 0; i < 24; i++) { const b = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: bubTex, transparent: true, opacity: 0.6, depthWrite: false }))); const r = s * (0.3 + rng.next() * 0.6); b.scale.set(r, r, 1); b.position.set((rng.next() - 0.5) * hw * 1.8, fy + rng.next() * H, z0 - rng.next() * L * 0.9); b.userData.v = s * (2 + rng.next() * 3); group.add(b); bubs.push(b); }
    for (let i = 0; i < 2; i++) { const l = new THREE.PointLight("#7fe8ff", 2, H * 1.3, 1.2); l.position.set((i ? 1 : -1) * hw * 0.5, fy + H * 0.8, z0 - L * (0.2 + i * 0.4)); group.add(l); lights.push(l); }
    animators.push((t, dt) => { floorTex.offset.set(Math.sin(t * 0.3) * 0.05, t * 0.02); for (const b of bubs) { b.position.y += (b.userData.v as number) * dt; if (b.position.y > fy + H * 1.1) b.position.y = fy; } });
  }
  if (style === "gold") {
    // treasure piles (instanced coins) and chests along the walls
    const coinGeo = keep(new THREE.CylinderGeometry(s * 0.45, s * 0.45, s * 0.12, 12));
    const coinMat = keep(new THREE.MeshStandardMaterial({ color: "#ffcf3a", metalness: 0.9, roughness: 0.25, emissive: "#5a3000", emissiveIntensity: 0.4 }));
    const piles = 6, per = 40, inst = new THREE.InstancedMesh(coinGeo, coinMat, piles * per);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    let k = 0;
    for (let p = 0; p < piles; p++) {
      const side = p % 2 ? 1 : -1, cx = side * (hw - s * (3 + rng.next() * 3)), cz = z0 - s * 6 - rng.next() * L * 0.75, rad = s * (2 + rng.next() * 2);
      for (let i = 0; i < per; i++) {
        const a = rng.next() * Math.PI * 2, r = Math.sqrt(rng.next()) * rad, h = (1 - r / rad) * rad * 0.7;
        e.set((rng.next() - 0.5) * 1.2, rng.next() * 3, (rng.next() - 0.5) * 1.2); q.setFromEuler(e);
        m4.compose(new THREE.Vector3(cx + Math.cos(a) * r, fy + h * rng.next() + s * 0.1, cz + Math.sin(a) * r), q, new THREE.Vector3(1, 1, 1));
        inst.setMatrixAt(k++, m4);
      }
      const chest = new THREE.Mesh(keep(new THREE.BoxGeometry(s * 2.4, s * 1.5, s * 1.5)), keep(new THREE.MeshStandardMaterial({ color: "#7a4a22", roughness: 0.6 })));
      chest.position.set(cx + side * s * 1.5, fy + s * 0.75, cz - rad); group.add(chest);
      const lid = new THREE.Mesh(keep(new THREE.BoxGeometry(s * 2.5, s * 0.3, s * 1.6)), coinMat); lid.position.set(chest.position.x, fy + s * 1.55, chest.position.z); group.add(lid);
    }
    inst.count = k; group.add(inst);
  }
  if (style === "marble") {
    // the altar: steps up to a stone table with a glowing orb at the far end
    for (let i = 0; i < 4; i++) { const st = new THREE.Mesh(keep(new THREE.BoxGeometry(hw * (1.1 - i * 0.18), s * 0.8, s * 3)), stoneMat); st.position.set(0, fy + s * 0.4 + i * s * 0.8, z1 + s * 14 - i * s * 3); group.add(st); }
    const orb = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: doorTex, color: glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
    orb.scale.set(s * 8, s * 8, 1); orb.position.set(0, fy + s * 5, z1 + s * 6); group.add(orb);
    const l = new THREE.PointLight(glow, 3, H * 1.6, 1.2); l.position.set(0, fy + s * 6, z1 + s * 10); group.add(l); lights.push(l);
    animators.push((t) => { orb.material.opacity = 0.75 + Math.sin(t * 1.5) * 0.2; });
  }
  if (style === "basalt") {
    // horned statues and rising embers over the lava
    const hornMat = keep(new THREE.MeshStandardMaterial({ color: "#3a2a28", roughness: 0.7 }));
    for (let i = 0; i < 4; i++) {
      const side = i % 2 ? 1 : -1, z = z0 - s * 8 - (i >> 1) * L * 0.35;
      const body = new THREE.Mesh(keep(new THREE.BoxGeometry(s * 2.2, s * 3, s * 2.2)), hornMat); body.position.set(side * (hw - s * 4), fy + s * 1.5, z); group.add(body);
      const head = new THREE.Mesh(keep(new THREE.SphereGeometry(s * 1.2, 10, 8)), hornMat); head.position.set(side * (hw - s * 4), fy + s * 3.8, z); group.add(head);
      for (const hs of [-1, 1]) { const horn = new THREE.Mesh(keep(new THREE.ConeGeometry(s * 0.35, s * 2, 8)), hornMat); horn.position.set(side * (hw - s * 4) + hs * s * 0.8, fy + s * 5, z); horn.rotation.z = -hs * 0.5; group.add(horn); }
      const eye = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: doorTex, color: "#ff3a10", transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))); eye.scale.set(s * 2.4, s * 1.2, 1); eye.position.set(side * (hw - s * 4), fy + s * 4, z + s * 1.3); group.add(eye);
    }
    const emTex = doorTex, ems: THREE.Sprite[] = [];
    for (let i = 0; i < 30; i++) { const e = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: emTex, color: "#ff8a2a", transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))); const r = s * (0.25 + rng.next() * 0.35); e.scale.set(r, r, 1); e.position.set((rng.next() - 0.5) * hw * 1.8, fy + rng.next() * H, z0 - rng.next() * L * 0.9); e.userData.v = s * (3 + rng.next() * 4); group.add(e); ems.push(e); }
    const l = new THREE.PointLight("#ff5a1a", 2.5, H * 1.4, 1.2); l.position.set(0, fy + s * 2, z0 - L * 0.3); group.add(l); lights.push(l);
    animators.push((t, dt) => { floorTex.offset.set(t * 0.01, Math.sin(t * 0.4) * 0.03); floorMat.emissiveIntensity = 0.8 + Math.sin(t * 2) * 0.15; for (const e of ems) { e.position.y += (e.userData.v as number) * dt; e.position.x += Math.sin(t + e.position.z) * dt * s; if (e.position.y > fy + H * 1.1) e.position.y = fy; } });
  }

  // ---------------------------------------------------------------- stage props: each stage picks its own mix
  const propOn = () => rng.next() < 0.55;
  const sideZ = () => [rng.next() < 0.5 ? -1 : 1, z0 - s * 5 - rng.next() * L * 0.8] as const;
  if (propOn()) {
    // tall vases along the walls
    const pts = [0, 0.5, 0.9, 1.1, 1, 0.7, 0.45, 0.5, 0.65].map((r, i) => new THREE.Vector2(r * s * 1.2, i * s * 0.55));
    const vGeo = keep(new THREE.LatheGeometry(pts, 16));
    const vMat = keep(new THREE.MeshStandardMaterial({ color: new THREE.Color(rng.next() < 0.5 ? "#b8643a" : "#3a6ab8").lerp(base, 0.3), roughness: 0.5, metalness: 0.1 }));
    for (let i = 0; i < 4 + rng.int(4); i++) { const [sd, z] = sideZ(); const v = new THREE.Mesh(vGeo, vMat); v.position.set(sd * (hw - s * (2.5 + rng.next() * 2)), fy, z); v.scale.setScalar(0.8 + rng.next() * 0.6); group.add(v); }
  }
  if (propOn() && !open) {
    // banners hanging on the walls, in the chamber's colour with an emblem
    const bTex = keep(bannerTex(glow, rng.int(4)));
    const bMat = keep(new THREE.MeshStandardMaterial({ map: bTex, side: THREE.DoubleSide, roughness: 0.8 }));
    for (let i = 0; i < 3 + rng.int(3); i++) {
      const [sd, z] = sideZ();
      const bn = plane(s * 3.2, s * 7, bMat); bn.rotation.y = -sd * Math.PI / 2; bn.position.set(sd * (hw - s * 0.3), fy + H * 0.5, z); group.add(bn);
      animators.push((t) => { bn.rotation.z = Math.sin(t * 0.8 + z) * 0.03; });
    }
  }
  if (propOn()) {
    // fire bowls on short stands down the middle edges
    const bowlGeo = keep(new THREE.CylinderGeometry(s * 1.1, s * 0.5, s * 0.8, 14)), standGeo = keep(new THREE.CylinderGeometry(s * 0.25, s * 0.4, s * 2.5, 8));
    const mMat = keep(new THREE.MeshStandardMaterial({ color: "#5a4a3a", metalness: 0.6, roughness: 0.4 }));
    for (let i = 0; i < 2 + rng.int(3); i++) {
      const [sd, z] = sideZ(), x = sd * hw * (0.45 + rng.next() * 0.25);
      const st = new THREE.Mesh(standGeo, mMat); st.position.set(x, fy + s * 1.25, z);
      const bw = new THREE.Mesh(bowlGeo, mMat); bw.position.set(x, fy + s * 2.8, z);
      const fl = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: flameTex, color: torchCol, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
      fl.scale.set(s * 2.2, s * 3, 1); fl.position.set(x, fy + s * 4.3, z);
      const hl = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: haloTex, color: torchCol, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending })));
      hl.scale.set(s * 10, s * 10, 1); hl.position.set(x, fy + s * 3.8, z - 1);
      group.add(st, bw, fl, hl);
      flames.push({ sp: fl, halo: hl, ph: rng.next() * 6 });
    }
  }
  if (propOn()) {
    // guardian statues on plinths
    const sMat = keep(new THREE.MeshStandardMaterial({ color: base.clone().lerp(new THREE.Color("#ffffff"), 0.25), roughness: 0.7 }));
    for (let i = 0; i < 2; i++) {
      const [, z] = sideZ(), sd = i ? 1 : -1, x = sd * (hw - s * 3.5);
      const pl = new THREE.Mesh(keep(new THREE.BoxGeometry(s * 2.6, s * 1.6, s * 2.6)), sMat); pl.position.set(x, fy + s * 0.8, z);
      const body = new THREE.Mesh(keep(new THREE.CylinderGeometry(s * 0.7, s * 1.0, s * 3.6, 10)), sMat); body.position.set(x, fy + s * 3.4, z);
      const head = new THREE.Mesh(keep(new THREE.SphereGeometry(s * 0.75, 12, 10)), sMat); head.position.set(x, fy + s * 5.8, z);
      const crest = new THREE.Mesh(keep(new THREE.ConeGeometry(s * 0.5, s * 1.2, 4)), sMat); crest.position.set(x, fy + s * 6.9, z);
      group.add(pl, body, head, crest);
    }
  }
  if (propOn()) {
    // rubble scattered on the floor
    const rGeo = keep(new THREE.DodecahedronGeometry(s * 0.6, 0)), rMat = keep(new THREE.MeshStandardMaterial({ color: base, roughness: 0.9, flatShading: true }));
    const n = 30, inst = new THREE.InstancedMesh(rGeo, rMat, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let i = 0; i < n; i++) { const sc = 0.4 + rng.next() * 1.4; q.setFromEuler(new THREE.Euler(rng.next() * 3, rng.next() * 3, rng.next() * 3)); m4.compose(new THREE.Vector3((rng.next() - 0.5) * hw * 1.8, fy + s * 0.25 * sc, z0 - rng.next() * L * 0.9), q, new THREE.Vector3(sc, sc * 0.7, sc)); inst.setMatrixAt(i, m4); }
    group.add(inst);
  }

  // ---------------------------------------------------------------- a dark see-through veil over the whole set, deeper
  // at the edges, so the set stays a backdrop and the bubbles stay the brightest thing on screen
  const veil = new THREE.Mesh(keep(new THREE.PlaneGeometry(W * 3, H * 3)), keep(new THREE.MeshBasicMaterial({ map: keep(veilTex()), transparent: true, depthWrite: false, fog: false })));
  veil.position.set(0, 0, -s * 2.2); veil.renderOrder = -1;
  group.add(veil);

  // torches flicker
  animators.push((t) => {
    for (const f of flames) {
      const k = 0.85 + Math.sin(t * 13 + f.ph) * 0.08 + Math.sin(t * 23 + f.ph * 2) * 0.06 + Math.random() * 0.05;
      f.sp.scale.set(s * 1.2 * (0.95 + (k - 0.85) * 0.8), s * 1.9 * k, 1);
      f.halo.material.opacity = 0.26 + (k - 0.85) * 0.9;
      if (f.light) f.light.intensity = 2.4 * k;
    }
  });

  return {
    group, fog,
    update: (t, dt) => { for (const a of animators) a(t, dt); },
    dispose: () => { trash.forEach((x) => x.dispose()); group.traverse((x) => { if ((x as THREE.PointLight).isPointLight) (x as THREE.PointLight).dispose(); }); },
  };
}

// ------------------------------------------------------------------ textures (drawn once per set)
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const rgb = (c: THREE.Color, k = 1) => `rgb(${Math.round(Math.min(1, c.r * k) * 255)},${Math.round(Math.min(1, c.g * k) * 255)},${Math.round(Math.min(1, c.b * k) * 255)})`;

/** wall and floor surfaces in each chamber's own material */
function surfaceTex(style: Style, base: THREE.Color, seed: number, floor = false) {
  const r = rngFrom(`tex:${seed}`);
  const t = canvasTex(256, 256, (g) => {
    g.fillStyle = rgb(base, 0.55); g.fillRect(0, 0, 256, 256);
    if (style === "brick" || style === "snake" || style === "marble") {
      const rows = floor ? 4 : 8, bh = 256 / rows, bw = floor ? 128 : 64;
      for (let y = 0; y < rows; y++) for (let x = -bw; x < 256; x += bw) {
        const off = y % 2 ? bw / 2 : 0, v = 0.8 + r.next() * 0.35;
        g.fillStyle = rgb(base, style === "marble" ? v * 1.25 : v); g.fillRect(x + off + 2, y * bh + 2, bw - 4, bh - 4);
        g.fillStyle = "rgba(255,255,255,.07)"; g.fillRect(x + off + 2, y * bh + 2, bw - 4, 3);
        g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(x + off + 2, y * bh + bh - 6, bw - 4, 4);
        if (style === "snake" && r.next() < 0.15) { g.strokeStyle = "rgba(120,255,170,.25)"; g.lineWidth = 3; g.beginPath(); g.arc(x + off + bw / 2, y * bh + bh / 2, bh * 0.3, 0, Math.PI * 1.6); g.stroke(); }
      }
    } else if (style === "moss") {
      for (let i = 0; i < 40; i++) { const v = 0.75 + r.next() * 0.4; g.fillStyle = rgb(base, v); g.fillRect(r.next() * 256, r.next() * 256, 30 + r.next() * 60, 20 + r.next() * 40); }
      for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${60 + r.int(60)},${140 + r.int(80)},${50 + r.int(40)},${0.25 + r.next() * 0.35})`; g.beginPath(); g.arc(r.next() * 256, r.next() * 256, 2 + r.next() * 7, 0, Math.PI * 2); g.fill(); }
    } else if (style === "rock" || style === "basalt") {
      for (let i = 0; i < 70; i++) { const v = 0.6 + r.next() * 0.5; g.fillStyle = rgb(base, v); g.beginPath(); const x = r.next() * 256, y = r.next() * 256, rr = 10 + r.next() * 30; for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; g.lineTo(x + Math.cos(a) * rr * (0.7 + r.next() * 0.5), y + Math.sin(a) * rr * (0.7 + r.next() * 0.5)); } g.fill(); }
      if (style === "basalt" && floor) { g.strokeStyle = "rgba(255,120,20,.95)"; g.lineWidth = 5; for (let i = 0; i < 14; i++) { g.beginPath(); let x = r.next() * 256, y = r.next() * 256; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r.next() - 0.5) * 70; y += (r.next() - 0.5) * 70; g.lineTo(x, y); } g.stroke(); } }
    } else if (style === "sea") {
      const gr = g.createLinearGradient(0, 0, 256, 256); gr.addColorStop(0, "#0e4a66"); gr.addColorStop(1, "#1a6a8a"); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
      g.strokeStyle = "rgba(160,240,255,.35)"; g.lineWidth = 3;
      for (let i = 0; i < 24; i++) { g.beginPath(); const y = r.next() * 256; g.moveTo(0, y); for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x / 20 + i) * 6); g.stroke(); }
    } else if (style === "gold") {
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const v = 0.85 + r.next() * 0.3; g.fillStyle = `rgb(${Math.round(200 * v)},${Math.round(150 * v)},${Math.round(60 * v)})`; g.fillRect(x * 32 + 2, y * 32 + 2, 28, 28); g.fillStyle = "rgba(255,240,180,.25)"; g.fillRect(x * 32 + 2, y * 32 + 2, 28, 4); }
    }
    for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(0,0,0,${r.next() * 0.09})`; g.fillRect(r.next() * 256, r.next() * 256, 2, 2); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
function skyTexFor(style: Style, realm: Realm, seed: number) {
  const r = rngFrom(`sky:${seed}`);
  return canvasTex(512, 512, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 512);
    if (style === "marble") { gr.addColorStop(0, "#05061a"); gr.addColorStop(0.6, realm.sky[1]); gr.addColorStop(1, realm.sky[2]); }
    else { gr.addColorStop(0, "#9fd8a0"); gr.addColorStop(0.5, "#5fa868"); gr.addColorStop(1, realm.sky[2]); }
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    if (style === "marble") for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + r.next() * 0.7})`; const sz = r.next() < 0.1 ? 2.5 : 1.2; g.fillRect(r.next() * 512, r.next() * 360, sz, sz); }
    else for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(30,${90 + r.int(60)},40,.55)`; g.beginPath(); g.arc(r.next() * 512, 300 + r.next() * 212, 30 + r.next() * 60, 0, Math.PI * 2); g.fill(); }
  });
}
function glowTex() {
  return canvasTex(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,.45)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  });
}
function flameTexture() {
  return canvasTex(64, 128, (g) => {
    const gr = g.createRadialGradient(32, 92, 2, 32, 80, 52);
    gr.addColorStop(0, "rgba(255,255,230,1)"); gr.addColorStop(0.3, "rgba(255,220,120,.95)"); gr.addColorStop(0.65, "rgba(255,140,40,.6)"); gr.addColorStop(1, "rgba(255,80,0,0)");
    g.fillStyle = gr; g.beginPath(); g.moveTo(32, 4); g.bezierCurveTo(58, 50, 60, 100, 32, 124); g.bezierCurveTo(4, 100, 6, 50, 32, 4); g.fill();
  });
}
/** a hanging banner with an emblem */
function bannerTex(col: THREE.Color, kind: number) {
  return canvasTex(64, 140, (g) => {
    g.fillStyle = rgb(col, 0.55); g.fillRect(0, 0, 64, 140);
    g.fillStyle = rgb(col, 0.85); g.fillRect(6, 0, 52, 128);
    g.fillStyle = "#3a2410"; g.beginPath(); g.moveTo(6, 128); g.lineTo(32, 112); g.lineTo(58, 128); g.lineTo(58, 140); g.lineTo(6, 140); g.fill();
    g.fillStyle = "#ffd85a"; g.strokeStyle = "#ffd85a"; g.lineWidth = 4;
    if (kind === 0) { g.beginPath(); g.arc(32, 52, 16, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(32, 52, 6, 0, Math.PI * 2); g.fill(); }
    else if (kind === 1) { g.beginPath(); g.moveTo(32, 28); g.lineTo(48, 60); g.lineTo(32, 80); g.lineTo(16, 60); g.closePath(); g.fill(); }
    else if (kind === 2) { for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(32, 36 + i * 18, 7, 0, Math.PI * 2); g.fill(); } }
    else { g.beginPath(); g.moveTo(32, 26); g.lineTo(36, 46); g.lineTo(54, 50); g.lineTo(36, 56); g.lineTo(32, 78); g.lineTo(28, 56); g.lineTo(10, 50); g.lineTo(28, 46); g.closePath(); g.fill(); }
    g.fillRect(6, 4, 52, 4); g.fillRect(6, 116, 52, 3);
  });
}
/** the veil: an even dim over the middle, darker toward the edges */
function veilTex() {
  return canvasTex(256, 256, (g) => {
    const gr = g.createRadialGradient(128, 118, 20, 128, 128, 150);
    gr.addColorStop(0, "rgba(6,4,12,.46)"); gr.addColorStop(0.55, "rgba(6,4,12,.55)"); gr.addColorStop(1, "rgba(4,2,8,.8)");
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  });
}
function moonTex() {
  return canvasTex(256, 256, (g) => {
    const gr = g.createRadialGradient(128, 128, 60, 128, 128, 128); gr.addColorStop(0, "rgba(255,250,230,.9)"); gr.addColorStop(0.55, "rgba(255,250,230,.25)"); gr.addColorStop(1, "rgba(255,250,230,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    g.fillStyle = "#fff8e6"; g.beginPath(); g.arc(128, 128, 62, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(200,190,170,.5)"; for (const [x, y, rr] of [[110, 110, 12], [150, 140, 9], [125, 155, 7], [145, 105, 6]]) { g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill(); }
  });
}
function bubbleTex() {
  return canvasTex(64, 64, (g) => {
    g.strokeStyle = "rgba(220,250,255,.9)"; g.lineWidth = 3; g.beginPath(); g.arc(32, 32, 26, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "rgba(255,255,255,.8)"; g.beginPath(); g.arc(23, 22, 6, 0, Math.PI * 2); g.fill();
  });
}
