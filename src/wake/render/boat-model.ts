// The boats of Wake Racers in 3D, built in code: a lofted deep-V hull (keel, chines, flared topsides, a painted stripe
// and boot line) shaped per boat, then each boat's own kit — the runabout's windscreen, the jet ski's seat and bars,
// the catamaran's twin hulls, the hydroplane's sponsons and tail fin, the hovercraft's skirt and caged fan, the tug's
// wheelhouse, funnel and tyre fenders, the offshore racer's canopy and twin engines, the twin-V's outboards, the
// hydrofoil's wings and the hover racer's glowing fins. A round clay pilot rides each one, helmet, goggles and all.
// +z is forward; the origin sits at the waterline in the middle of the hull.
import * as THREE from "three";
import { part, merge, box, cyl, cone, sphere, torus, boatMaterial, smoothMaterial } from "./kit";
import type { BoatId } from "../boats";
import type { Pilot } from "../boats";
import { rgb, srgbToLinear, shade } from "../util";

export interface BoatModel {
  group: THREE.Group;
  /** spins with the throttle (propellers, fans) */
  spinner: THREE.Object3D | null;
  /** leans into turns */
  pilot: THREE.Object3D;
  scarf: THREE.Object3D;
  /** stern (z) and half beam, for the wake and spray */
  stern: number; beam: number;
  dispose(): void;
}

type Livery = { hull: string; deck: string; stripe: string; trim: string };

/** a lofted V hull: length L, beam B, depth D, bow lift; colours for bottom, sides, stripe and deck */
function hull(L: number, B: number, D: number, bowLift: number, cols: { bottom: string; side: string; stripe: string; deck: string }, flat = 0.6) {
  const N = 12, pos: number[] = [], col: number[] = [], idx: number[] = [];
  const c = (hex: string) => { const [r, g, b] = rgb(hex); return [srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255), 0]; };
  const cb = c(cols.bottom), cs = c(cols.side), cst = c(cols.stripe), cd = c(cols.deck);
  // ring points per section (from port gunwale round the keel to starboard gunwale), then the deck centre
  const ring = (u: number) => {
    // u: 0 = stern, 1 = bow
    const taper = u < 0.55 ? 1 : Math.cos(((u - 0.55) / 0.45) * Math.PI * 0.5);
    const w = (B / 2) * Math.max(0.02, taper) * (0.92 + 0.08 * (1 - u));
    const keel = -D + bowLift * Math.pow(Math.max(0, u - 0.45) / 0.55, 2) * D;
    const top = 0.35 * D + 0.15 * D * u;
    const z = -L / 2 + u * L;
    return [
      [-w, top, z, 3], [-w * 1.02, top - 0.18 * D, z, 2], [-w * 0.98, top - 0.5 * D, z, 1], [-w * flat, keel * 0.45 + top * 0.0 - 0.2 * D, z, 0], [0, keel, z, 0],
      [w * flat, keel * 0.45 - 0.2 * D, z, 0], [w * 0.98, top - 0.5 * D, z, 1], [w * 1.02, top - 0.18 * D, z, 2], [w, top, z, 3],
    ];
  };
  const rings: number[][][] = [];
  for (let i = 0; i <= N; i++) rings.push(ring(i / N));
  const R = rings[0].length;
  const tone = [cb, cs, cst, cs];
  for (const rr of rings) for (const p of rr) { pos.push(p[0], p[1], p[2]); col.push(...tone[p[3]]); }
  for (let i = 0; i < N; i++) for (let k = 0; k < R - 1; k++) {
    const a = i * R + k, b = a + 1, cc = a + R, d = cc + 1;
    idx.push(a, b, cc, b, d, cc);
  }
  // transom (stern face)
  const tb = pos.length / 3;
  for (const p of rings[0]) { pos.push(p[0], p[1], p[2]); col.push(...cs); }
  for (let k = 1; k < R - 1; k++) idx.push(tb, tb + k + 1, tb + k);
  // deck: a fan between gunwales
  const db = pos.length / 3;
  for (let i = 0; i <= N; i++) { const l = rings[i][0], r = rings[i][R - 1]; pos.push(l[0] * 0.98, l[1] + 0.02, l[2], r[0] * 0.98, r[1] + 0.02, r[2]); col.push(...cd, ...cd); }
  for (let i = 0; i < N; i++) { const a = db + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function pilotModel(p: Pilot, seated = false) {
  const g = new THREE.Group();
  const body = merge([
    part(sphere(0.42, 14, 10), p.skin, { p: [0, 0.5, 0], s: [1, 1.15, 0.95] }),
    part(sphere(0.47, 14, 8), p.helmet, { p: [0, 0.78, -0.02], s: [1, 0.72, 1.02] }),
    part(box(0.62, 0.12, 0.1), "#1A1A2E", { p: [0, 0.74, 0.4] }),
    part(sphere(0.12, 8, 6), "#9AD8FF", { p: [-0.15, 0.74, 0.42], s: [1, 0.8, 0.6], glow: 0.2 }), part(sphere(0.12, 8, 6), "#9AD8FF", { p: [0.15, 0.74, 0.42], s: [1, 0.8, 0.6], glow: 0.2 }),
    part(sphere(0.06, 6, 4), "#FF8A8A", { p: [-0.24, 0.52, 0.36] }), part(sphere(0.06, 6, 4), "#FF8A8A", { p: [0.24, 0.52, 0.36] }),
    part(box(0.14, 0.04, 0.04), "#5A2A2A", { p: [0, 0.48, 0.41] }),
    ...(seated ? [part(sphere(0.16, 8, 6), p.skin, { p: [-0.34, 0.45, 0.32] }), part(sphere(0.16, 8, 6), p.skin, { p: [0.34, 0.45, 0.32] })] : []),
  ]);
  g.add(new THREE.Mesh(body, smoothMaterial()));
  // a scarf tail that flutters in the wind
  const scarf = new THREE.Mesh(merge([part(box(0.16, 0.05, 0.7), shade(p.helmet === "#FFFFFF" ? "#FF5A5F" : p.helmet, 0.1), { p: [0, 0, -0.35] })]), smoothMaterial());
  scarf.position.set(0.12, 0.42, -0.3);
  g.add(scarf);
  return { g, scarf };
}

export function buildBoat(id: BoatId, L: Livery, pilot: Pilot): BoatModel {
  const group = new THREE.Group();
  const mat = boatMaterial(), glass = new THREE.MeshPhongMaterial({ color: "#9AD8FF", transparent: true, opacity: 0.55, shininess: 120, specular: new THREE.Color(1, 1, 1) });
  const geos: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, m: THREE.Material = mat) => { geos.push(g); const me = new THREE.Mesh(g, m); group.add(me); return me; };
  let spinner: THREE.Object3D | null = null;
  const seat = new THREE.Vector3(0, 0.35, -0.4);
  let seated = false, stern = -2.2, beam = 1.1;
  const bottom = shade(L.hull, -0.55);
  const prop = (z: number, y: number, x = 0) => {
    const p = new THREE.Mesh(merge([part(box(0.7, 0.12, 0.05), "#C8C8D0", { r: [0, 0, 0] }), part(box(0.12, 0.7, 0.05), "#C8C8D0")]), mat);
    // the propeller turns under the water: built (it spins in the art shots) but not drawn in races
    p.position.set(x, y, z); p.visible = false; group.add(p); geos.push(p.geometry); return p;
  };
  switch (id) {
    case "minnow": {
      add(hull(4.6, 2, 0.75, 0.7, { bottom, side: L.hull, stripe: L.stripe, deck: L.deck }));
      add(merge([part(box(1.6, 0.5, 0.08), "#FFFFFF", { p: [0, 0.75, 0.55], r: [-0.5, 0, 0] }), part(box(1.4, 0.35, 1.2), L.trim, { p: [0, 0.48, -0.9] })]));
      add(merge([part(box(1.5, 0.42, 0.04), "#BFE6FF", { p: [0, 0.82, 0.6], r: [-0.55, 0, 0] })]), glass);
      add(merge([part(box(0.5, 0.8, 0.5), "#2A2A2E", { p: [0, 0.2, -2.45] }), part(box(0.3, 0.3, 0.6), L.trim, { p: [0, 0.6, -2.5] })]));
      spinner = prop(-2.75, -0.35); seat.set(0, 0.35, -0.2); stern = -2.4; beam = 1;
      break;
    }
    case "zip": {
      add(hull(3.2, 1.3, 0.55, 0.8, { bottom, side: L.hull, stripe: L.stripe, deck: L.deck }, 0.5));
      add(merge([part(box(0.55, 0.3, 1.4), L.deck, { p: [0, 0.5, -0.4] }), part(cyl(0.05, 0.05, 0.9, 6), "#2A2A2E", { p: [0, 0.85, 0.55], r: [0, 0, Math.PI / 2] }),
        part(box(0.12, 0.5, 0.12), "#2A2A2E", { p: [0, 0.6, 0.5] }), part(box(0.9, 0.2, 0.6), L.stripe, { p: [0, 0.4, 0.9] }), part(box(0.6, 0.12, 0.3), L.trim, { p: [0, 0.32, -1.55] })]));
      seat.set(0, 0.42, -0.25); seated = true; stern = -1.6; beam = 0.65;
      break;
    }
    case "cat": {
      for (const x of [-1.1, 1.1]) { const g = hull(5.2, 0.9, 0.7, 0.4, { bottom, side: L.hull, stripe: L.stripe, deck: L.hull }, 0.4); g.translate(x, 0, 0); add(g); }
      add(merge([part(box(3, 0.18, 3.6), L.deck, { p: [0, 0.55, -0.2] }), part(box(2.2, 0.7, 1.4), L.stripe, { p: [0, 0.98, 0.4] }), part(box(0.1, 1.2, 0.1), "#E8E8E8", { p: [0, 1.6, -1.5] })]));
      add(merge([part(box(2, 0.5, 0.05), "#BFE6FF", { p: [0, 1.25, 1.12], r: [-0.4, 0, 0] })]), glass);
      for (const x of [-1.1, 1.1]) spinner = prop(-2.75, -0.4, x);
      seat.set(0, 0.62, -0.6); stern = -2.6; beam = 1.6;
      break;
    }
    case "dart": {
      add(hull(5.6, 1.2, 0.5, 0.5, { bottom, side: L.hull, stripe: L.stripe, deck: L.deck }, 0.4));
      for (const x of [-1.15, 1.15]) add(merge([part(cyl(0.35, 0.35, 2.6, 10), L.hull, { p: [x, 0, 1.2], r: [Math.PI / 2, 0, 0] }), part(cone(0.35, 0.8, 10), L.stripe, { p: [x, 0, 2.9], r: [Math.PI / 2, 0, 0] }), part(box(0.9, 0.1, 0.6), L.trim, { p: [x * 0.6, 0.15, 1.6] })]));
      add(merge([part(box(0.12, 1.1, 1), L.stripe, { p: [0, 0.9, -2.4] }), part(box(1.8, 0.1, 0.7), L.trim, { p: [0, 1.45, -2.5] }), part(box(0.9, 0.35, 1.2), L.trim, { p: [0, 0.45, -0.5] })]));
      add(merge([part(sphere(0.55, 10, 6), "#BFE6FF", { p: [0, 0.55, 0.35], s: [1, 0.6, 1.4] })]), glass);
      spinner = prop(-2.95, -0.25); seat.set(0, 0.25, -0.1); stern = -2.8; beam = 1.3;
      break;
    }
    case "hover": {
      add(merge([part(torus(1.55, 0.45, 8, 22), "#2A2A3A", { p: [0, -0.05, 0], r: [Math.PI / 2, 0, 0], s: [1, 1.45, 1] })]));
      add(merge([part(box(2.6, 0.5, 4), L.hull, { p: [0, 0.35, 0] }), part(box(2.2, 0.2, 3.4), L.deck, { p: [0, 0.65, 0] }), part(box(2.7, 0.15, 0.3), L.stripe, { p: [0, 0.5, 2] })]));
      add(merge([part(torus(1.15, 0.14, 6, 20), L.stripe, { p: [0, 1.65, -1.6] }), part(box(0.15, 1.5, 0.15), "#2A2A3A", { p: [-1.05, 1, -1.6] }), part(box(0.15, 1.5, 0.15), "#2A2A3A", { p: [1.05, 1, -1.6] }),
        part(box(0.12, 1.3, 0.8), L.trim, { p: [-0.5, 1.6, -2.2] }), part(box(0.12, 1.3, 0.8), L.trim, { p: [0.5, 1.6, -2.2] })]));
      const fan = new THREE.Mesh(merge([part(box(2, 0.25, 0.06), "#E8E8E8"), part(box(0.25, 2, 0.06), "#E8E8E8"), part(sphere(0.2, 8, 6), L.trim)]), mat);
      fan.position.set(0, 1.65, -1.6); group.add(fan); geos.push(fan.geometry); spinner = fan;
      seat.set(0, 0.7, 0.3); stern = -2.2; beam = 1.5;
      break;
    }
    case "tug": {
      add(hull(5, 2.3, 0.95, 0.35, { bottom, side: L.hull, stripe: L.stripe, deck: L.deck }, 0.8));
      add(merge([part(box(1.7, 1.3, 1.6), L.deck, { p: [0, 1.05, 0.2] }), part(box(1.9, 0.14, 1.8), L.stripe, { p: [0, 1.75, 0.2] }),
        part(cyl(0.26, 0.3, 1.2, 8), L.trim, { p: [0, 1.6, -0.9] }), part(cyl(0.3, 0.3, 0.25, 8), "#1A1A1A", { p: [0, 2.25, -0.9] }),
        ...[-1, 1].flatMap((sx) => [1.2, 0, -1.2].map((z) => part(torus(0.25, 0.1, 5, 10), "#1A1A1A", { p: [sx * 1.18, 0.15, z], r: [0, Math.PI / 2, 0] })))]));
      add(merge([part(box(1.4, 0.45, 0.04), "#BFE6FF", { p: [0, 1.25, 1.01] })]), glass);
      spinner = prop(-2.6, -0.5); seat.set(0, 0.9, 0.2); stern = -2.5; beam = 1.15;
      break;
    }
    case "offshore": {
      add(hull(6.4, 2, 0.65, 0.9, { bottom, side: L.hull, stripe: L.stripe, deck: L.deck }));
      add(merge([part(box(1.5, 0.35, 2), L.deck, { p: [0, 0.5, -0.4] }), part(box(2, 0.1, 0.6), L.trim, { p: [0, 0.5, 2.6] })]));
      add(merge([part(sphere(0.8, 12, 8), "#9AD8FF", { p: [0, 0.6, 0.2], s: [0.9, 0.5, 1.5] })]), glass);
      for (const x of [-0.55, 0.55]) add(merge([part(box(0.5, 0.9, 0.6), "#1A1A2E", { p: [x, 0.25, -3.1] }), part(box(0.35, 0.35, 0.5), L.stripe, { p: [x, 0.75, -3.15] })]));
      spinner = prop(-3.45, -0.4, 0); seat.set(0, 0.4, 0.1); stern = -3.2; beam = 1;
      break;
    }
    case "bolt": {
      add(hull(5.8, 2.1, 0.7, 0.75, { bottom, side: L.hull, stripe: L.stripe, deck: L.deck }));
      add(merge([part(box(1.8, 0.5, 0.08), "#FFFFFF", { p: [0, 0.8, 0.7], r: [-0.55, 0, 0] }), part(box(2.2, 0.1, 0.5), L.trim, { p: [0, 1.15, -2.2] }),
        part(box(0.1, 0.6, 0.4), L.trim, { p: [-1, 0.85, -2.2] }), part(box(0.1, 0.6, 0.4), L.trim, { p: [1, 0.85, -2.2] })]));
      add(merge([part(box(1.7, 0.45, 0.04), "#BFE6FF", { p: [0, 0.86, 0.75], r: [-0.6, 0, 0] })]), glass);
      for (const x of [-0.6, 0.6]) add(merge([part(box(0.45, 0.85, 0.5), "#1A1A1A", { p: [x, 0.3, -3] }), part(box(0.47, 0.3, 0.52), L.stripe, { p: [x, 0.65, -3] })]));
      spinner = prop(-3.3, -0.35); seat.set(0, 0.4, -0.3); stern = -2.9; beam = 1.05;
      break;
    }
    case "foil": {
      add(hull(5.4, 1.8, 0.6, 0.8, { bottom, side: L.hull, stripe: L.stripe, deck: L.deck }));
      add(merge([part(box(0.15, 1.1, 0.4), "#C8CCD8", { p: [0, -0.9, 1.6] }), part(box(2.4, 0.08, 0.6), L.stripe, { p: [0, -1.45, 1.6] }),
        part(box(0.15, 1.1, 0.4), "#C8CCD8", { p: [0, -0.9, -1.8] }), part(box(1.6, 0.08, 0.5), L.stripe, { p: [0, -1.45, -1.8] }),
        part(box(1.4, 0.35, 1.4), L.trim, { p: [0, 0.5, -0.6] })]));
      add(merge([part(sphere(0.7, 12, 8), "#9AD8FF", { p: [0, 0.55, 0.4], s: [1, 0.55, 1.4] })]), glass);
      spinner = prop(-2.8, -1.45); seat.set(0, 0.4, -0.2); stern = -2.7; beam = 0.9;
      break;
    }
    case "comet": {
      add(merge([part(sphere(1.2, 16, 10), L.hull, { p: [0, 0.35, 0], s: [1, 0.42, 2.4] }), part(box(2.6, 0.08, 0.5), L.deck, { p: [0, 0.2, -1.8], glow: 0.9 }),
        part(box(0.06, 0.08, 4.4), L.stripe, { p: [-0.95, 0.42, 0], glow: 1 }), part(box(0.06, 0.08, 4.4), L.stripe, { p: [0.95, 0.42, 0], glow: 1 }),
        part(box(0.1, 0.9, 1), L.deck, { p: [-0.9, 0.7, -2.1], r: [0, 0, 0.3], glow: 0.7 }), part(box(0.1, 0.9, 1), L.deck, { p: [0.9, 0.7, -2.1], r: [0, 0, -0.3], glow: 0.7 }),
        part(cyl(0.35, 0.45, 0.4, 10), "#1A1A2E", { p: [0, 0.35, -2.75], r: [Math.PI / 2, 0, 0] }), part(cyl(0.3, 0.3, 0.05, 10), L.stripe, { p: [0, 0.35, -2.97], r: [Math.PI / 2, 0, 0], glow: 1 })]));
      add(merge([part(sphere(0.65, 12, 8), "#9AF6FF", { p: [0, 0.65, 0.3], s: [1, 0.6, 1.6], glow: 0.2 })]), glass);
      seat.set(0, 0.4, -0.2); stern = -2.7; beam = 1.1;
      break;
    }
  }
  const { g: pg, scarf } = pilotModel(pilot, seated);
  pg.position.copy(seat);
  pg.scale.setScalar(id === "zip" ? 0.85 : 0.8);
  group.add(pg);
  // float: lift the whole boat so the hull sits on the water with its freeboard showing
  const LIFT: Record<BoatId, number> = { minnow: 0.5, zip: 0.38, cat: 0.5, dart: 0.32, hover: 0.32, tug: 0.62, offshore: 0.45, bolt: 0.5, foil: 0.42, comet: 0.12 };
  for (const ch of group.children) ch.position.y += LIFT[id];
  return {
    group, spinner, pilot: pg, scarf, stern, beam,
    dispose() {
      for (const g of geos) g.dispose();
      mat.dispose(); glass.dispose();
      pg.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); if (m.material) (m.material as THREE.Material).dispose(); });
    },
  };
}
