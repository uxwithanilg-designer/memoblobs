// Everything on the water of a Wake Racers course: hazards (one instanced mesh per kind; moving ones follow their
// clock, knocked buoys and barrels tumble away, mines vanish in a blast), sliding lock gates, crossing ferries and
// cruising traffic, ramps and boost pads, bridges on pillars, rock arches and tunnels, whirlpools, the start gantry,
// the finish arch, checkpoint gates, the docking berth, buoy chains along open-water lanes, and the pickups — spinning
// coins, beating hearts, oil cans and glowing power boxes.
import * as THREE from "three";
import type { Quality } from "@/lib/perf";
import { DS, PRE, halfWidthAt, lowerBound, place, waterAt, type Course, type Obstacle } from "../course";
import { propGeometry } from "./props";
import { part, merge, box, cyl, cone, sphere, ball, rock, torus, extrude, worldMaterial, smoothMaterial, dummy } from "./kit";
import { shade } from "../util";

type G = THREE.BufferGeometry;
const P = { x: 0, z: 0 };

const OBST_GEO: Record<string, (c: Course) => G> = {
  rock: (c) => merge([part(rock(1.6, 3, 1, 0.75), c.world.land.high, { p: [0, 0.5, 0] }), part(rock(0.9, 7, 0, 0.8), c.world.land.mid, { p: [0.9, 0.2, 0.6] })]),
  lavarock: () => merge([part(rock(1.6, 5, 1, 0.75), "#2B2626", { p: [0, 0.5, 0] }), part(rock(0.7, 2, 0, 1), "#FF5A1F", { p: [0.4, 1.2, 0.3], glow: 1 })]),
  iceberg: () => merge([part(rock(2.2, 9, 1, 0.9), "#EAF7FF", { p: [0, 0.9, 0] }), part(rock(1.2, 4, 0, 1.6), "#BFE6FF", { p: [0.6, 2.1, 0.2] })]),
  crystal: () => merge([part(cone(0.9, 3.4, 5), "#B07CFF", { p: [0, 1.7, 0], glow: 1 }), part(cone(0.6, 2.4, 5), "#36E3FF", { p: [0.7, 1.1, 0.3], r: [0, 0, -0.4], glow: 1 }), part(cone(0.5, 2, 5), "#FF5FD2", { p: [-0.6, 1, -0.2], r: [0, 0, 0.4], glow: 1 })]),
  log: () => merge([part(cyl(0.5, 0.5, 6.4, 8), "#7A5434", { r: [0, 0, Math.PI / 2], p: [0, 0.15, 0] }), part(cyl(0.42, 0.42, 6.5, 8), "#C89A6A", { r: [0, 0, Math.PI / 2], p: [0, 0.15, 0] }), part(cyl(0.15, 0.1, 0.8, 5), "#7A5434", { p: [1.2, 0.6, 0], r: [0.4, 0, 0] })]),
  mine: () => merge([part(sphere(0.85, 12, 8), "#2A2E36", { p: [0, 0.55, 0] }), ...[0, 1, 2, 3, 4, 5].map((i) => part(cone(0.16, 0.5, 5), "#C8CCD8", { p: [Math.cos(i * 1.05) * 0.85, 0.55 + (i % 2 ? 0.4 : -0.1), Math.sin(i * 1.05) * 0.85], r: [Math.sin(i * 1.05) * 1.5, 0, -Math.cos(i * 1.05) * 1.5] })), part(sphere(0.18, 6, 4), "#FF3B3B", { p: [0, 1.42, 0], glow: 1 })]),
  barrel: () => merge([part(cyl(0.6, 0.6, 1.3, 10), "#E03A3A", { p: [0, 0.3, 0] }), part(cyl(0.62, 0.62, 0.12, 10), "#2A2A2A", { p: [0, 0.65, 0] }), part(cyl(0.62, 0.62, 0.12, 10), "#2A2A2A", { p: [0, -0.05, 0] }), part(box(0.5, 0.5, 0.02), "#FFD23F", { p: [0, 0.35, 0.6] })]),
  crate: () => merge([part(box(1.5, 1.5, 1.5), "#C8955A", { p: [0, 0.4, 0] }), part(box(1.56, 0.2, 1.56), "#8A5A30", { p: [0, 0.95, 0] }), part(box(1.56, 0.2, 1.56), "#8A5A30", { p: [0, -0.15, 0] }), part(box(0.2, 1.56, 1.56), "#8A5A30", { p: [0, 0.4, 0], r: [0.78, 0, 0] })]),
  debris: () => merge([part(box(4.4, 0.35, 1.2), "#6A5A4A", { p: [0, 0.1, 0] }), part(box(1.2, 0.5, 0.8), "#4A3A2A", { p: [1.3, 0.3, 0.2] }), part(cyl(0.12, 0.12, 2, 5), "#8A7A6A", { p: [-1.1, 0.5, 0], r: [0, 0, 1.2] })]),
  drone: () => merge([part(sphere(0.9, 12, 8), "#1A1C3A", { p: [0, 1.6, 0], s: [1.3, 0.6, 1.3] }), part(torus(1.4, 0.12, 4, 16), "#FF3DCB", { p: [0, 1.6, 0], r: [Math.PI / 2, 0, 0], glow: 1 }), part(sphere(0.3, 8, 6), "#36E3FF", { p: [0, 1.3, 0.8], glow: 1 }), part(cyl(0.05, 0.05, 1.6, 4), "#FF3DCB", { p: [0, 0.7, 0], glow: 1 })]),
  buoy: () => merge([part(cyl(0.55, 0.7, 0.9, 10), "#FF5A1F", { p: [0, 0.3, 0] }), part(cyl(0.35, 0.5, 0.8, 10), "#FFFFFF", { p: [0, 1.1, 0] }), part(cone(0.35, 0.5, 10), "#FF5A1F", { p: [0, 1.75, 0] }), part(sphere(0.12, 6, 4), "#FFE066", { p: [0, 2.05, 0], glow: 0.5 })]),
  pillar: (c) => merge([part(cyl(1.2, 1.4, 12, 10), c.world.profile === "neon" ? "#22244A" : c.walls ? "#A89880" : "#8A8A8A", { p: [0, 4, 0] }), part(cyl(1.5, 1.5, 0.6, 10), shade(c.world.land.mid, -0.2), { p: [0, -0.2, 0] })]),
  gate: (c) => merge([part(box(1, 4.2, 1.1), c.world.profile === "neon" ? "#1A1C3A" : "#4A5A6A", { p: [0, 1.6, 0] }), part(box(1.06, 0.4, 1.16), "#FFC233", { p: [0, 2.9, 0], glow: 0.6 }), part(box(1.06, 0.4, 1.16), "#1A1A1A", { p: [0, 2.3, 0] })]),
  ferry: () => merge([
    part(extrude([[-8, 0], [7, 0], [9, 2.4], [-8.4, 2.4]], 6.2), "#F4F7FB", { p: [0, -0.6, 0], r: [0, Math.PI / 2, 0] }),
    part(box(6.4, 0.5, 17), "#2E6E9A", { p: [0, 0.1, 0] }),
    part(box(5, 2.4, 7), "#FFFFFF", { p: [0, 3, -1] }), part(box(5.06, 0.6, 7.06), "#9AD8FF", { p: [0, 3.4, -1], glow: 0.4 }),
    part(box(3.6, 1.8, 3), "#FFFFFF", { p: [0, 5.1, -2] }), part(cyl(0.6, 0.7, 2.2, 8), "#E03A3A", { p: [0, 6.6, -3.4] }), part(cyl(0.62, 0.62, 0.4, 8), "#1A1A1A", { p: [0, 7.8, -3.4] }),
  ]),
  moored: (c) => propGeometry("moored", c.world, 1, 3),
  traffic: () => merge([
    part(extrude([[-3.4, 0], [2.6, 0], [3.6, 1.4], [-3.6, 1.4]], 2.8), "#2E6E4A", { p: [0, -0.5, 0], r: [0, Math.PI / 2, 0] }),
    part(box(2.6, 0.2, 6.6), "#F4E3C1", { p: [0, 0.92, 0] }), part(box(2.2, 1.5, 2.2), "#FFFFFF", { p: [0, 1.7, -1.6] }), part(box(2.26, 0.4, 2.26), "#9AD8FF", { p: [0, 2.1, -1.6], glow: 0.4 }),
    part(box(2.4, 1, 2.4), "#FFB21F", { p: [0, 1.5, 1.2] }), part(box(2.4, 1, 2.4), "#2E9BFF", { p: [0, 1.5, 1.2 + 0.01], s: [0.6, 1.02, 0.6] }),
  ]),
};

/** the drawn window along the course, behind and ahead of the camera (m) */
const BEHIND = 160, AHEAD = 1300, WIN = BEHIND + AHEAD + 40;
/** the most entries of a sorted array that fit in any window of length w */
function windowMax(a: Float32Array, w: number) {
  let best = 0;
  for (let i = 0, j = 0; i < a.length; i++) { while (a[i] - a[j] > w) j++; best = Math.max(best, i - j + 1); }
  return best;
}

export class Objects {
  readonly group = new THREE.Group();
  private mat = worldMaterial();
  /** the material the static pieces use */
  get material() { return this.mat; }
  private soft = smoothMaterial();
  private geos: G[] = [];
  private mats: THREE.Material[] = [];
  /** per hazard kind: the mesh, its hazards (sorted along the course), their s0, and the cruising ones */
  private kinds = new Map<string, { mesh: THREE.InstancedMesh; list: Obstacle[]; s: Float32Array; roam: Obstacle[] }>();
  /** per pickup kind: the mesh, its items (sorted) and their s */
  private pick = new Map<string, { mesh: THREE.InstancedMesh; ids: number[]; s: Float32Array }>();
  private knock = new Float32Array(0);
  private whirlMat: THREE.ShaderMaterial | null = null;
  private pop = new Float32Array(0);
  private gone = new Uint8Array(0);
  private buoyGeo: G | null = null;

  constructor(readonly c: Course, q: Quality) {
    this.mats.push(this.mat, this.soft);
    // ---- hazards, one instanced mesh per kind
    // (each frame only the ones within the drawn window are written into the first slots: a 30 km course has
    // thousands, the camera sees a few hundred)
    const byKind = new Map<string, Obstacle[]>();
    for (const o of c.obstacles) { if (o.kind === "prop" || o.kind === "seastack") continue; const k = o.kind; if (!byKind.has(k)) byKind.set(k, []); byKind.get(k)!.push(o); }
    for (const [k, all] of byKind) {
      const make = OBST_GEO[k]; if (!make) continue;
      const list = all.filter((o) => o.motion !== "cruise"), roam = all.filter((o) => o.motion === "cruise");
      const sArr = Float32Array.from(list, (o) => o.s0);
      const g = make(c); this.geos.push(g);
      const mesh = new THREE.InstancedMesh(g, this.mat, Math.max(1, windowMax(sArr, WIN) + roam.length + 2));
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.group.add(mesh);
      this.kinds.set(k, { mesh, list, s: sArr, roam });
    }
    this.knock = new Float32Array(c.obstacles.length).fill(-1);

    this.buoyGeo = merge([part(sphere(0.32, 8, 6), "#FF5A1F", { p: [0, 0.15, 0] }), part(cyl(0.05, 0.05, 0.6, 4), "#FFFFFF", { p: [0, 0.5, 0] })]);
    this.geos.push(this.buoyGeo);

    // ---- whirlpools
    if (c.whirls.length) {
      this.whirlMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uTime: { value: 0 }, uDeep: { value: new THREE.Color(c.mood.water.deep) }, uFoam: { value: new THREE.Color(c.mood.water.foam) } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: `uniform float uTime; uniform vec3 uDeep, uFoam; varying vec2 vUv;
          void main(){ float r = length(vUv); if (r > 1.0) discard; float a = atan(vUv.y, vUv.x);
            float arms = sin(a * 4.0 + r * 14.0 - uTime * 5.0) * 0.5 + 0.5;
            vec3 c = mix(uDeep * 0.35, uFoam, smoothstep(0.55, 0.9, arms) * smoothstep(0.08, 0.5, r));
            gl_FragColor = vec4(c, (1.0 - smoothstep(0.75, 1.0, r)) * 0.9);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      });
      this.mats.push(this.whirlMat);
      for (const w of c.whirls) {
        const g = new THREE.CircleGeometry(w.r * 1.5, 32); g.rotateX(-Math.PI / 2); this.geos.push(g);
        const m = new THREE.Mesh(g, this.whirlMat); m.position.set(w.x, w.y + 0.06, w.z); this.group.add(m);
      }
    }

    // ---- pickups
    const coinG = merge([part(cyl(0.62, 0.62, 0.16, 16), "#FFC233", { r: [Math.PI / 2, 0, 0], glow: 0.62 }), part(cyl(0.45, 0.45, 0.2, 16), "#FFE066", { r: [Math.PI / 2, 0, 0], glow: 0.66 }), part(box(0.14, 0.5, 0.22), "#E8A317", { glow: 0.6 })]);
    const heartG = merge([part(extrude([[0, -0.9], [0.95, 0.1], [0.95, 0.55], [0.5, 0.95], [0, 0.6], [-0.5, 0.95], [-0.95, 0.55], [-0.95, 0.1]], 0.45, 0.08), "#FF3B5C", { glow: 0.7 })]);
    const fuelG = merge([part(box(1.1, 1.4, 0.55), "#E03A3A", { glow: 0.55 }), part(box(0.7, 0.18, 0.18), "#1A1A1A", { p: [0, 0.82, 0] }), part(cyl(0.1, 0.12, 0.45, 6), "#FFC233", { p: [0.4, 0.85, 0], r: [0, 0, -0.6] }), part(box(0.6, 0.6, 0.02), "#FFE066", { p: [0, 0, 0.29], glow: 0.6 })]);
    const boxG = merge([part(box(1.4, 1.4, 1.4), "#7A4AD8", { glow: 0.75 }), ...[[-1, 1], [1, 1], [-1, -1], [1, -1]].flatMap(([a, b]) => [part(box(1.5, 0.12, 0.12), "#36E3FF", { p: [0, a * 0.7, b * 0.7], glow: 1 }), part(box(0.12, 1.5, 0.12), "#FF3DCB", { p: [a * 0.7, 0, b * 0.7], glow: 1 }), part(box(0.12, 0.12, 1.5), "#FFE24A", { p: [a * 0.7, b * 0.7, 0], glow: 1 })]), part(ball(0.35, 0), "#FFFFFF", { glow: 1 })]);
    this.geos.push(coinG, heartG, fuelG, boxG);
    for (const [k, g, m] of [["coin", coinG, this.mat], ["heart", heartG, this.soft], ["fuel", fuelG, this.mat], ["box", boxG, this.mat]] as const) {
      const ids = c.items.filter((i) => i.kind === k).map((i) => i.id);
      const sArr = Float32Array.from(ids, (i) => c.items[i].s);
      const mesh = new THREE.InstancedMesh(g, m, Math.max(1, windowMax(sArr, WIN) + 2));
      mesh.frustumCulled = false; mesh.count = 0;
      this.group.add(mesh);
      this.pick.set(k, { mesh, ids, s: sArr });
    }
    this.pop = new Float32Array(c.items.length).fill(-1);
    this.gone = new Uint8Array(c.items.length);
    void q;
  }

  /** the static pieces (ramps, pads, bridges, arches and tunnels, gantries, checkpoints, the dock) of the stretch [s0, s1) */
  staticPiece(s0: number, s1: number): G | null {
    const c = this.c;
    const parts: G[] = [];
    const inside = (x: number) => x >= s0 && x < s1;
    const angAt = (s: number) => { const i = Math.round((s + PRE) / DS); return Math.atan2(c.tx[Math.min(c.count - 1, Math.max(0, i))], c.tz[Math.min(c.count - 1, Math.max(0, i))]); };
    for (const r of c.ramps) {
      if (!inside(r.s)) continue;
      const col = r.kind === "metal" ? "#8A94A6" : r.kind === "rock" ? c.world.land.high : r.kind === "neon" ? "#1A1C3A" : "#B07A48";
      const g = merge([
        part(extrude([[0, 0], [r.len, 0], [r.len, r.h], [r.len - 0.4, r.h]], r.w * 2), col, { r: [0, -Math.PI / 2, 0] }),
        ...[-1, 1].map((s) => part(box(0.2, 0.25, r.len), "#FFC233", { p: [s * r.w, 0, 0], glow: 0.5 })),
        ...[0.25, 0.5, 0.75].map((f) => part(box(r.w * 2 - 0.4, 0.06, 0.3), shade(col, -0.25), { p: [0, r.h * f + 0.03, r.len * f - r.len / 2 + 0.6], r: [-Math.atan2(r.h, r.len), 0, 0] })),
        part(box(r.w * 2, 0.3, 0.3), "#FFFFFF", { p: [0, r.h - 0.1, r.len / 2], glow: 0.4 }),
      ]);
      g.translate(0, 0, r.len / 2);
      g.rotateY(r.ang); g.translate(r.x, waterAt(c, r.s), r.z);
      parts.push(g);
    }
    for (const pd of c.pads) {
      if (!inside(pd.s)) continue;
      const arrows: G[] = [];
      for (let k = 0; k < 3; k++) arrows.push(part(extrude([[-pd.w * 0.8, 0], [0, 1.4], [pd.w * 0.8, 0], [pd.w * 0.8, 0.6], [0, 2], [-pd.w * 0.8, 0.6]], 0.08), k % 2 ? "#36E3FF" : "#FFE24A", { p: [0, 0.06, -pd.len / 2 + 0.6 + k * 2.1], r: [Math.PI / 2, 0, 0], glow: 1 }));
      const g = merge([part(box(pd.w * 2, 0.08, pd.len), "#1A1C3A", { p: [0, 0.02, 0] }), ...arrows]);
      g.rotateY(pd.ang); g.translate(pd.x, waterAt(c, pd.s) + 0.03, pd.z);
      parts.push(g);
    }
    for (const b of c.bridges) {
      if (!inside(b.s)) continue;
      const style = b.style, deckCol = style === 0 ? "#B8A890" : style === 1 ? c.world.accent : "#9A6A40";
      const L2 = b.w * 2 + 14, y = waterAt(c, b.s) + b.deck;
      const g = merge([
        part(box(9, 1.2, L2), deckCol, { p: [0, y, 0] }),
        part(box(9.4, 0.4, L2), shade(deckCol, -0.25), { p: [0, y - 0.75, 0] }),
        ...[-1, 1].map((sx) => part(box(0.3, 1.1, L2), shade(deckCol, 0.2), { p: [sx * 4.4, y + 1.1, 0] })),
        ...[-1, 1].flatMap((sx) => Array.from({ length: Math.floor(L2 / 8) }, (_, i) => part(sphere(0.25, 6, 4), "#FFE6A0", { p: [sx * 4.4, y + 1.9, -L2 / 2 + 4 + i * 8], glow: 0.5 }))),
        ...(style === 1 ? [-1, 1].map((sx) => part(box(0.4, 0.4, L2), shade(deckCol, -0.1), { p: [sx * 4.4, y + 4, 0] })) : []),
        ...(style === 0 ? [part(torus(b.w * 0.5, 0.8, 4, 12, Math.PI), "#A89880", { p: [0, y - b.deck * 0.1, 0], r: [0, Math.PI / 2, 0], s: [1, b.deck / (b.w * 0.5), 1] })] : []),
      ]);
      g.rotateY(b.ang + Math.PI / 2); g.translate(b.x, 0, b.z);
      g.rotateY(0);
      parts.push(g);
    }
    for (const cv of c.covers) {
      if (!inside(cv.s0)) continue;
      const tunnel = cv.kind === "tunnel";
      const neon = c.world.profile === "neon", brick = c.walls;
      const colr = neon ? "#1A1C3A" : brick ? "#A0705A" : c.world.land.high;
      for (let s = cv.s0; s <= cv.s1; s += tunnel ? 5 : 16) {
        const hw = halfWidthAt(c, s) + 2.5, y = waterAt(c, s);
        place(c, s, 0, P);
        const ring = merge([
          part(torus(hw, tunnel ? 1.6 : 3.2, 5, 14, Math.PI), colr, { s: [1, tunnel ? 0.72 : 0.9, 1] }),
          ...(neon || (tunnel && c.world.profile === "cave") ? [part(torus(hw - 1.4, 0.12, 4, 18, Math.PI), neon ? "#36E3FF" : "#B07CFF", { s: [1, 0.72, 1], glow: 1 })] : []),
          ...(brick && tunnel ? [part(sphere(0.3, 6, 4), "#FFD98A", { p: [0, hw * 0.72 - 1.2, 0], glow: 0.5 })] : []),
        ]);
        ring.rotateY(angAt(s)); ring.translate(P.x, y - 1.5, P.z);
        parts.push(ring);
      }
    }
    // the start gantry and the finish arch
    const gantry = (s: number, finish: boolean) => {
      const hw = halfWidthAt(c, s) + 2, y = waterAt(c, s);
      const bar: G[] = [];
      for (let k = 0; k < Math.floor(hw * 2 / 1.2); k++) bar.push(part(box(0.6, 0.6, 1.2), finish ? (k % 2 ? "#1A1A1A" : "#FFFFFF") : "#1A1C3A", { p: [0, 9 + (k % 2 ? 0.6 : 0), -hw + 0.6 + k * 1.2], glow: finish ? 0 : 0 }));
      const g = merge([
        ...[-1, 1].map((sx) => part(box(1.2, 11, 1.2), finish ? "#FF3B5C" : c.world.accent, { p: [0, 4.5, sx * hw] })),
        part(box(1, 1.6, hw * 2 + 1.2), finish ? "#FF3B5C" : c.world.accent, { p: [0, 10.2, 0] }),
        ...bar,
        ...(!finish ? [0, 1, 2, 3, 4].map((k) => part(sphere(0.45, 8, 6), "#FF3B3B", { p: [0.6, 8.4, -2.4 + k * 1.2], glow: 1 })) : []),
      ]);
      place(c, s, 0, P);
      g.rotateY(angAt(s) + Math.PI / 2); g.translate(P.x, y, P.z);
      parts.push(g);
    };
    if (inside(0)) gantry(0, false);
    if (inside(c.length)) gantry(c.length, true);
    for (const cs of c.checkpoints) {
      if (!inside(cs)) continue;
      const hw = halfWidthAt(c, cs) + 1, y = waterAt(c, cs);
      const col = c.plan.mode === "knockout" ? "#FF5A5F" : c.plan.mode === "rush" ? "#FFC233" : c.world.accent2;
      const g = merge([
        part(torus(hw, 0.7, 6, 20, Math.PI), col, { s: [1, 0.45, 1] }),
        part(torus(hw, 0.72, 6, 20, Math.PI), "#FFFFFF", { s: [1, 0.45, 1.01], r: [0, 0, 0] }),
      ]);
      g.scale(1, 1, 0.2);
      place(c, cs, 0, P);
      g.rotateY(angAt(cs)); g.translate(P.x, y - 0.4, P.z);
      parts.push(g);
    }
    if (c.dock && inside(c.dock.s)) {
      const dk = c.dock, y = waterAt(c, dk.s);
      const g = merge([
        part(box(dk.w * 2, 0.06, dk.len), "#B98CFF", { p: [0, 0.05, 0], glow: 1 }), part(box(dk.w * 2 - 0.6, 0.07, dk.len - 0.6), "#1A1430", { p: [0, 0.06, 0] }),
        ...[-1, 1].map((sx) => part(box(1.2, 0.5, dk.len + 3), "#9A6A40", { p: [sx * (dk.w + 0.9), 0.6, 0] })),
        ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => part(cyl(0.25, 0.3, 1.6, 8), "#FFC233", { p: [sx * (dk.w + 0.9), 1.2, sz * dk.len / 2], glow: 0.5 }))),
        part(box(dk.w * 2 + 3, 0.6, 1.4), "#9A6A40", { p: [0, 0.6, dk.len / 2 + 1.2] }),
      ]);
      g.rotateY(dk.ang); g.translate(dk.x, y, dk.z);
      parts.push(g);
    }
    return parts.length ? merge(parts) : null;

  }

  /** the buoy chain of one stretch */
  buoyPiece(list: { x: number; y: number; z: number }[]) {
    if (!list.length || !this.buoyGeo) return null;
    const m = new THREE.InstancedMesh(this.buoyGeo, this.soft, list.length);
    const col = new THREE.Color();
    list.forEach((b, i) => { dummy.position.set(b.x, b.y, b.z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); m.setColorAt(i, col.set(i % 4 < 2 ? "#ffffff" : "#ffd23f")); });
    m.computeBoundingSphere();
    return m;
  }

  private placeObstacles(t: number, dt: number, sv: number) {
    const c = this.c;
    for (const { mesh, list, s: sArr, roam } of this.kinds.values()) {
      let n = 0;
      const a = lowerBound(sArr, sv - BEHIND), b = lowerBound(sArr, sv + AHEAD);
      for (let q = a, end = b + roam.length; q < end; q++) {
        const o = q < b ? list[q] : roam[q - b];
        if (q >= b && (o.s < sv - BEHIND || o.s > sv + AHEAD)) continue;
        const k = n;
        let ang = Math.atan2(c.tx[Math.max(0, Math.min(c.count - 1, Math.round((o.s + PRE) / DS)))], c.tz[Math.max(0, Math.min(c.count - 1, Math.round((o.s + PRE) / DS)))]) + o.ang;
        if (o.kind === "traffic" && o.speed < 0) ang += Math.PI;
        const bob = Math.sin(t * 1.6 + o.id) * 0.12;
        if (!o.alive) {
          // knocked flying, or blown up
          if (o.explode) continue;
          if (this.knock[o.id] < 0) this.knock[o.id] = 0;
          const kt = (this.knock[o.id] += dt);
          if (kt > 1.6) continue;
          dummy.position.set(o.x + (o.knockX ?? 0) * kt, o.y + 6 * kt - 9 * kt * kt, o.z + (o.knockZ ?? 0) * kt);
          dummy.rotation.set(kt * 7, ang + kt * 5, kt * 4); dummy.scale.setScalar(o.size); dummy.updateMatrix(); mesh.setMatrixAt(k, dummy.matrix);
          n++;
          continue;
        }
        if (this.knock[o.id] >= 0) this.knock[o.id] = -1;
        dummy.position.set(o.x, o.y + (o.kind === "drone" ? Math.sin(t * 2 + o.id) * 0.4 : o.kind === "pillar" || o.kind === "gate" ? 0 : bob), o.z);
        dummy.rotation.set(o.kind === "mine" || o.kind === "buoy" ? Math.sin(t * 1.3 + o.id) * 0.12 : 0, o.kind === "drone" ? t * 1.2 : ang, o.kind === "buoy" ? Math.cos(t * 1.1 + o.id) * 0.12 : 0);
        if (o.kind === "gate") dummy.scale.set(1, 1, o.size);
        else if (o.kind === "pillar") dummy.scale.set(o.size, o.h > 10 ? 1 : 0.55, o.size);
        else dummy.scale.setScalar(o.size);
        dummy.updateMatrix(); mesh.setMatrixAt(k, dummy.matrix);
        n++;
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** sv: where along the course the camera looks (only that stretch is drawn) */
  update(t: number, dt: number, sv: number) {
    this.placeObstacles(t, dt, sv);
    const c = this.c;
    const spin = t * 2.4;
    for (const { mesh, ids, s: sArr } of this.pick.values()) {
      let n = 0;
      for (let q = lowerBound(sArr, sv - BEHIND), end = lowerBound(sArr, sv + AHEAD); q < end; q++) {
        const i = ids[q], it = c.items[i];
        if (it.taken) {
          if (!this.gone[i]) { this.gone[i] = 1; this.pop[i] = 0; }
          if (this.pop[i] < 0) continue;
          const pt = (this.pop[i] += dt);
          if (pt > 0.35) { this.pop[i] = -1; continue; }
          dummy.position.set(it.x, it.y + pt * 6, it.z); dummy.rotation.set(0, spin * 3, 0); dummy.scale.setScalar(1.3 * (1 - pt / 0.35)); dummy.updateMatrix(); mesh.setMatrixAt(n++, dummy.matrix);
          continue;
        }
        if (this.gone[i]) { this.gone[i] = 0; this.pop[i] = -1; }
        const bob = Math.sin(t * 2.2 + i) * 0.15;
        const sc = it.kind === "heart" ? 1 + Math.max(0, Math.sin(t * 6 + i)) * 0.15 : 1;
        dummy.position.set(it.x, it.y + bob, it.z);
        dummy.rotation.set(it.kind === "box" ? t * 0.9 : 0, spin + i * 0.3, it.kind === "box" ? t * 0.6 : 0);
        dummy.scale.setScalar(sc); dummy.updateMatrix(); mesh.setMatrixAt(n++, dummy.matrix);
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (this.whirlMat) this.whirlMat.uniforms.uTime.value = t;
  }

  dispose() { for (const g of this.geos) g.dispose(); for (const m of this.mats) m.dispose(); for (const { mesh } of this.kinds.values()) mesh.dispose(); for (const { mesh } of this.pick.values()) mesh.dispose(); }
}
