// The floating road, built in chunks of 120 m: a thick slab (top, sides and underside) that follows the track frames,
// angled kerb stripes along both top edges, low striped curbs where the road has rails, a rounded top on beams, and
// its own surface on planks and beams (wood), islands (grass), glass, metal rails and the start and finish (chequered);
// tube stretches get a glass shell over the top with glowing ribs.
import * as THREE from "three";
import type { World } from "../data/worlds";
import type { Track } from "../track";
import { checkerTex, roadTex, stripeTex } from "./tex";

export const CHUNK = 120;
const T = 1.3; // slab thickness

type Bucket = { pos: number[]; nor: number[]; uv: number[]; idx: number[] };
const bucket = (): Bucket => ({ pos: [], nor: [], uv: [], idx: [] });

export interface Chunk { i: number; group: THREE.Group; geos: THREE.BufferGeometry[] }

export class TrackMeshes {
  readonly mats: Record<string, THREE.Material>;
  constructor(readonly tr: Track, world: World, quality: "low" | "medium" | "high") {
    const R = world.road;
    const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.02, ...o });
    this.mats = {
      road: std({ color: R.top, map: roadTex(R.line) }),
      wood: std({ color: "#C08A52", map: roadTex("#000", "plank"), roughness: 0.75 }),
      grass: std({ color: world.pal.grass, roughness: 0.85 }),
      check: std({ map: checkerTex(), roughness: 0.5 }),
      side: std({ color: R.side, roughness: 0.8 }),
      under: std({ color: new THREE.Color(R.side).multiplyScalar(0.6), roughness: 0.9 }),
      stripe: std({ map: stripeTex(R.stripeA, R.stripeB), roughness: 0.45, ...(R.glow ? { emissive: new THREE.Color(R.glow), emissiveIntensity: 0.35 } : {}) }),
      rail: std({ map: stripeTex(R.stripeA, R.stripeB), roughness: 0.4 }),
      glow: new THREE.MeshBasicMaterial({ color: R.glow ?? R.stripeA }),
      glassTop: new THREE.MeshPhysicalMaterial({ color: "#BFF4FF", roughness: 0.04, metalness: 0, transmission: 0.5, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
      metalTop: new THREE.MeshStandardMaterial({ color: "#D8E0EA", roughness: 0.18, metalness: 0.9 }),
      tube: new THREE.MeshStandardMaterial({ color: "#E8FDFF", emissive: new THREE.Color("#9FE8FF"), emissiveIntensity: 0.25, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
      rib: new THREE.MeshBasicMaterial({ color: R.glow ?? "#7CF2FF", transparent: true, opacity: 0.85 }),
    };
    void quality;
  }

  build(i: number): Chunk {
    const tr = this.tr, s0 = i * CHUNK, s1 = Math.min(tr.len, s0 + CHUNK + 1);
    const B: Record<string, Bucket> = {};
    const get = (k: string) => (B[k] ??= bucket());
    const F = new Float32Array(12), G = new Float32Array(12);
    const v3 = (fr: Float32Array, x: number, y: number) => [fr[0] + fr[9] * x + fr[6] * y, fr[1] + fr[10] * x + fr[7] * y, fr[2] + fr[11] * x + fr[8] * y];
    // ribbon helper: a quad strip between two frames for a cross-section line from (xa,ya) to (xb,yb)
    const quad = (k: string, fa: Float32Array, fb: Float32Array, a0: [number, number], a1: [number, number], b0: [number, number], b1: [number, number], n: [number, number, number], va: number, vb: number, ua = 0, ub = 1) => {
      const q = get(k), base = q.pos.length / 3;
      for (const [fr, p, u, v] of [[fa, a0, ua, va], [fa, a1, ub, va], [fb, b0, ua, vb], [fb, b1, ub, vb]] as const) {
        const w = v3(fr, p[0], p[1]); q.pos.push(w[0], w[1], w[2]);
        // normal in the frame's basis: n = [across, up, along]
        q.nor.push(fr[9] * n[0] + fr[6] * n[1] + fr[3] * n[2], fr[10] * n[0] + fr[7] * n[1] + fr[4] * n[2], fr[11] * n[0] + fr[8] * n[1] + fr[5] * n[2]);
        q.uv.push(u, v);
      }
      // (a0, a1, b0) and (a1, b1, b0): right × forward = up, so tops face the sky
      q.idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    };
    const step = 1;
    for (let s = s0; s < s1 - 1e-6; s += step) {
      const sb = Math.min(s + step, s1);
      const seg = tr.segAt(s + 0.5);
      if (seg.floor !== "road") continue;
      tr.frame(s, F); tr.frame(sb, G);
      const wa = tr.widthAt(s) / 2, wb = tr.widthAt(sb) / 2;
      const look = seg.look ?? "road";
      const topK = look === "plank" || look === "beam" || look === "kicker" ? "wood" : look === "island" ? "grass" : look === "glass" ? "glassTop" : look === "rail" ? "metalTop" : "road";
      const crown = seg.crown ?? 0;
      const N = Math.abs(crown) > 0.01 ? 6 : 1;
      const yA = (x: number, w: number) => (crown ? -0.45 * crown * x * x * (w < 2 ? 1 : 0.6) : 0);
      const va = s / 6, vb = sb / 6;
      // top (split across for crowns and dishes)
      for (let k = 0; k < N; k++) {
        const t0 = k / N, t1 = (k + 1) / N;
        const xa0 = -wa + 2 * wa * t0, xa1 = -wa + 2 * wa * t1, xb0 = -wb + 2 * wb * t0, xb1 = -wb + 2 * wb * t1;
        quad(topK, F, G, [xa0, yA(xa0, wa)], [xa1, yA(xa1, wa)], [xb0, yA(xb0, wb)], [xb1, yA(xb1, wb)], [0, 1, 0], va, vb, t0 * (wa / 3), t1 * (wa / 3));
      }
      // kerb stripes along both edges (just above the top)
      if (wa > 1.4) {
        const sw = Math.min(0.5, wa * 0.12);
        quad("stripe", F, G, [-wa, yA(-wa, wa) + 0.012], [-wa + sw, yA(-wa + sw, wa) + 0.012], [-wb, yA(-wb, wb) + 0.012], [-wb + sw, yA(-wb + sw, wb) + 0.012], [0, 1, 0], s / 3, sb / 3);
        quad("stripe", F, G, [wa - sw, yA(wa - sw, wa) + 0.012], [wa, yA(wa, wa) + 0.012], [wb - sw, yA(wb - sw, wb) + 0.012], [wb, yA(wb, wb) + 0.012], [0, 1, 0], s / 3, sb / 3);
      }
      // sides and underside
      const yl = yA(-wa, wa), yr = yA(wa, wa), ylb = yA(-wb, wb), yrb = yA(wb, wb);
      quad("side", F, G, [-wa, -T], [-wa, yl], [-wb, -T], [-wb, ylb], [-1, 0, 0], va, vb);
      quad("side", F, G, [wa, yr], [wa, -T], [wb, yrb], [wb, -T], [1, 0, 0], va, vb);
      quad("under", F, G, [wa, -T], [-wa, -T], [wb, -T], [-wb, -T], [0, -1, 0], va, vb);
      // curbs
      const H = 0.42, C = 0.3;
      if (seg.railL) {
        quad("rail", F, G, [-wa, H], [-wa + C, H], [-wb, H], [-wb + C, H], [0, 1, 0], s / 3, sb / 3, 0, 0.3);
        quad("rail", F, G, [-wa + C, H], [-wa + C, 0], [-wb + C, H], [-wb + C, 0], [1, 0, 0], s / 3, sb / 3, 0.3, 1);
        quad("rail", F, G, [-wa, 0], [-wa, H], [-wb, 0], [-wb, H], [-1, 0, 0], s / 3, sb / 3, 0.3, 1);
      }
      if (seg.railR) {
        quad("rail", F, G, [wa - C, H], [wa, H], [wb - C, H], [wb, H], [0, 1, 0], s / 3, sb / 3, 0, 0.3);
        quad("rail", F, G, [wa - C, 0], [wa - C, H], [wb - C, 0], [wb - C, H], [-1, 0, 0], s / 3, sb / 3, 0.3, 1);
        quad("rail", F, G, [wa, H], [wa, 0], [wb, H], [wb, 0], [1, 0, 0], s / 3, sb / 3, 0.3, 1);
      }
      // a glass tube over the road: a shell from kerb to kerb, a glowing rib every 6 m
      if (seg.tube) {
        const N2 = 10, Ra = wa + 0.3, Rb = wb + 0.3, rib = Math.floor(s / 6) !== Math.floor(sb / 6) || s % 6 < 1;
        for (let k = 0; k < N2; k++) {
          const a0 = (k / N2) * Math.PI, a1 = ((k + 1) / N2) * Math.PI;
          const pa0: [number, number] = [Math.cos(a0) * Ra, Math.sin(a0) * Ra * 0.95], pa1: [number, number] = [Math.cos(a1) * Ra, Math.sin(a1) * Ra * 0.95];
          const pb0: [number, number] = [Math.cos(a0) * Rb, Math.sin(a0) * Rb * 0.95], pb1: [number, number] = [Math.cos(a1) * Rb, Math.sin(a1) * Rb * 0.95];
          quad("tube", F, G, pa1, pa0, pb1, pb0, [-Math.cos((a0 + a1) / 2), -Math.sin((a0 + a1) / 2), 0], va, vb);
          if (rib) { const t = 0.12, q0: [number, number] = [pa0[0] * 1.01, pa0[1] * 1.01], q1: [number, number] = [pa1[0] * 1.01, pa1[1] * 1.01]; const Gr = new Float32Array(12); tr.frame(s + t * 2, Gr); quad("rib", F, Gr, q1, q0, q1, q0, [0, 0, 1], 0, 1); }
        }
      }
    }
    const group = new THREE.Group(), geos: THREE.BufferGeometry[] = [];
    for (const [k, q] of Object.entries(B)) {
      if (!q.idx.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(q.pos, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(q.nor, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(q.uv, 2));
      g.setIndex(q.idx);
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, this.mats[k]);
      m.receiveShadow = k !== "tube" && k !== "rib"; m.castShadow = k === "side" || k === "rail";
      if (k === "tube") m.renderOrder = 2;
      group.add(m); geos.push(g);
    }
    return { i, group, geos };
  }
  disposeChunk(c: Chunk) { c.group.removeFromParent(); for (const g of c.geos) g.dispose(); }
  dispose() { for (const m of Object.values(this.mats)) m.dispose(); }
}
