// Everything that follows the road: surface, kerbs, run-off, verge skirt, start line, barriers (swept 3D
// profiles), the start gantry, instanced overhead arches, tunnels / galleries and street lamps with fake light.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { GfxQuality, ThemeSpec, Weather } from "../types";
import type { Track } from "../track";
import type { ThemeLook, OverheadKind, LampKind } from "./themes";
import { P, merge, propMat, PROP_UNIFORMS } from "./props";
import * as TX from "./textures";

// ---------------------------------------------------------------- sweep
/**
 * Sweep a 2D cross-section along the track. Profile points are [d, y]: lateral offset (m, + = right) and
 * height above the (banked) road surface. u runs along the track (m / uScale), v along the profile (0..1).
 */
export function sweep(track: Track, profile: [number, number][], o: { sMin?: number; sMax?: number; every?: number; uScale?: number; caps?: boolean; noise?: number; flipV?: boolean } = {}) {
  const every = o.every ?? 2, uScale = o.uScale ?? 4, sMin = o.sMin ?? 0, sMax = o.sMax ?? Infinity;
  const loop = sMin === 0 && sMax === Infinity;
  const idx: number[] = [];
  for (let i = 0; i < track.n; i += every) { const s = i * track.step; if (s >= sMin && s <= sMax) idx.push(i); }
  if (loop) idx.push(0);
  const np = profile.length, nr = idx.length;
  const pos = new Float32Array(nr * np * 3), uv = new Float32Array(nr * np * 2);
  const plen: number[] = [0];
  for (let k = 1; k < np; k++) plen.push(plen[k - 1] + Math.hypot(profile[k][0] - profile[k - 1][0], profile[k][1] - profile[k - 1][1]));
  const total = plen[np - 1] || 1;
  let u = 0;
  for (let r = 0; r < nr; r++) {
    const i = idx[r];
    if (r > 0) { const p = idx[r - 1]; u += Math.hypot(track.px[i] - track.px[p], track.py[i] - track.py[p], track.pz[i] - track.pz[p]) / uScale; }
    for (let k = 0; k < np; k++) {
      let [d, y] = profile[k];
      if (o.noise) { const h = Math.sin(i * 0.37 + k * 1.7) * 43758.5453; const n = (h - Math.floor(h) - 0.5) * o.noise; d += n * Math.sign(d || 1) * 0.6; y += Math.abs(n) * (y > 0.2 ? 1 : 0); }
      const q = (r * np + k);
      pos[q * 3] = track.px[i] + track.rx[i] * d;
      pos[q * 3 + 1] = track.py[i] - d * track.bank[i] + y;
      pos[q * 3 + 2] = track.pz[i] + track.rz[i] * d;
      uv[q * 2] = u; uv[q * 2 + 1] = o.flipV ? 1 - plen[k] / total : plen[k] / total;
    }
  }
  const index: number[] = [];
  for (let r = 0; r < nr - 1; r++) for (let k = 0; k < np - 1; k++) {
    const a = r * np + k, b = a + 1, c = a + np, d = c + 1;
    index.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  if (o.caps && !loop && nr > 1) {
    // close both ends with a fan over the profile polygon (profiles are convex enough for this)
    const capParts: THREE.BufferGeometry[] = [g.toNonIndexed()];
    for (const r of [0, nr - 1]) {
      const cp: number[] = [], cuv: number[] = [];
      const cxp = profile.reduce((a, p) => a + p[0], 0) / np, cyp = profile.reduce((a, p) => a + p[1], 0) / np;
      const i = idx[r];
      const W = (d: number, y: number) => [track.px[i] + track.rx[i] * d, track.py[i] - d * track.bank[i] + y, track.pz[i] + track.rz[i] * d];
      for (let k = 0; k < np - 1; k++) {
        const A = W(cxp, cyp), B = W(profile[k][0], profile[k][1]), C = W(profile[k + 1][0], profile[k + 1][1]);
        if (r === 0) cp.push(...A, ...C, ...B); else cp.push(...A, ...B, ...C);
        cuv.push(0.5, 0.5, 0, 0, 1, 0);
      }
      const cg = new THREE.BufferGeometry();
      cg.setAttribute("position", new THREE.Float32BufferAttribute(cp, 3));
      cg.setAttribute("uv", new THREE.Float32BufferAttribute(cuv, 2));
      cg.computeVertexNormals();
      capParts.push(cg);
    }
    const m = mergeGeometries(capParts);
    g.dispose();
    return m;
  }
  return g;
}

/** split [0, L) intervals that may wrap around the start line */
function wrapRanges(track: Track, ranges: [number, number][]) {
  const out: [number, number][] = [], L = track.length;
  for (const [a, b] of ranges) {
    if (a < 0) { out.push([L + a, L - 0.01], [0, b]); } else if (b > L) { out.push([a, L - 0.01], [0, b - L]); } else out.push([a, b]);
  }
  return out;
}
/** stretches of road that bend tighter than radius R (m), expanded by `pad` metres */
export function cornerRanges(track: Track, R = 140, pad = 18) {
  const raw: [number, number][] = [];
  let start = -1;
  for (let i = 0; i <= track.n; i++) {
    const on = i < track.n && Math.abs(track.k[i]) > 1 / R;
    if (on && start < 0) start = i;
    if (!on && start >= 0) { raw.push([start * track.step - pad, i * track.step + pad]); start = -1; }
  }
  const merged: [number, number][] = [];
  for (const r of raw) { const last = merged[merged.length - 1]; if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]); else merged.push([...r]); }
  return merged;
}

// ---------------------------------------------------------------- road surface & edges
export function buildRoad(track: Track, l: ThemeLook, theme: ThemeSpec, q: GfxQuality, weather: Weather, night: boolean, renderer: THREE.WebGLRenderer) {
  const root = new THREE.Group();
  const hw = track.halfWidth, sh = track.shoulder;
  const wet = weather === "rain" || l.road.kind === "wet";
  const lanes = Math.max(2, Math.round((hw * 2) / 4.6));
  const tx = TX.road(l.road, lanes, wet);
  tx.map.anisotropy = Math.min(q === "low" ? 2 : 8, renderer.capabilities.getMaxAnisotropy());
  const glossy = wet || l.road.kind === "ice" || l.road.kind === "glass";
  const roadMat = new THREE.MeshStandardMaterial({
    map: tx.map, roughness: glossy ? 1 : l.road.kind === "metal" ? 0.45 : 0.86, roughnessMap: tx.rough,
    metalness: l.road.kind === "metal" ? 0.35 : 0.0, envMapIntensity: wet ? 1.6 : glossy ? 1.2 : 0.5,
    color: wet && l.road.kind !== "wet" ? new THREE.Color(0.72, 0.72, 0.76) : new THREE.Color(1, 1, 1),
  });
  if (tx.emissive) { roadMat.emissiveMap = tx.emissive; roadMat.emissive = new THREE.Color("#ffffff"); roadMat.emissiveIntensity = night ? 1.0 : 0.55; }
  const road = new THREE.Mesh(track.ribbon(-hw, hw, { vScale: 10 }), roadMat);
  road.name = "road";
  road.receiveShadow = q !== "low";
  root.add(road);

  // run-off (gravel / grass) on both sides, just below the road surface
  const soMat = new THREE.MeshStandardMaterial({ map: TX.gravel(l.shoulder), roughness: 1, envMapIntensity: 0.3 });
  const so = new THREE.Mesh(mergeGeometries([track.ribbon(-hw - sh - 1.5, -hw + 0.05, { lift: -0.025, vScale: 8 }), track.ribbon(hw - 0.05, hw + sh + 1.5, { lift: -0.025, vScale: 8 })]), soMat);
  so.receiveShadow = q !== "low";
  root.add(so);
  // verge skirt hides the seam between run-off and terrain
  if (!l.floating) {
    const vc = new THREE.Color(l.ground.verge ?? l.ground.colors[0]);
    const skirt = mergeGeometries([sweep(track, [[-hw - sh - 6, -1.6], [-hw - sh - 1.5, -0.03]], { every: 2, uScale: 6 }), sweep(track, [[hw + sh + 1.5, -0.03], [hw + sh + 6, -1.6]], { every: 2, uScale: 6 })]);
    const det = l.ground.detail && l.ground.detail !== "none" ? TX.groundDetail(l.ground.detail) : null;
    const sk = new THREE.Mesh(skirt, new THREE.MeshStandardMaterial({ color: vc, map: det, roughness: 1, envMapIntensity: 0.4 }));
    sk.receiveShadow = q !== "low";
    root.add(sk);
  } else {
    // floating road: give it a thick glowing underside
    const slab = mergeGeometries([sweep(track, [[hw + sh + 1.5, -0.03], [hw + sh + 1.5, -1.6], [-hw - sh - 1.5, -1.6], [-hw - sh - 1.5, -0.03]], { every: 2, uScale: 8 })]);
    root.add(new THREE.Mesh(slab, new THREE.MeshStandardMaterial({ color: "#F4E8FF", emissive: new THREE.Color("#FF9BE8"), emissiveIntensity: 0.35, roughness: 0.6 })));
  }

  // kerbs: raised, striped, on corners (or all the way round)
  const mode = l.curbs ?? "corners";
  if (mode !== "none") {
    const ranges = mode === "full" ? [[0, Infinity] as [number, number]] : wrapRanges(track, cornerRanges(track));
    const parts: THREE.BufferGeometry[] = [];
    for (const [a, b] of ranges) {
      const o = b === Infinity ? {} : { sMin: a, sMax: b };
      const ev = mode === "full" ? 2 : 1;
      parts.push(sweep(track, [[-hw - 1.15, 0.015], [-hw - 0.3, 0.09], [-hw + 0.05, 0.02]], { ...o, every: ev, uScale: 4 }));
      parts.push(sweep(track, [[hw - 0.05, 0.02], [hw + 0.3, 0.09], [hw + 1.15, 0.015]], { ...o, every: ev, uScale: 4 }));
    }
    if (parts.length) {
      const k = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ map: TX.curb(l.curb[0], l.curb[1]), roughness: 0.55, envMapIntensity: 0.6 }));
      k.receiveShadow = q !== "low";
      root.add(k);
    }
  }
  // start / finish chequer
  root.add(new THREE.Mesh(track.ribbon(-hw, hw, { lift: 0.025, vScale: 1.2, sMin: 0, sMax: 2.4, uRepeat: 6 }), new THREE.MeshStandardMaterial({ map: TX.checker(), roughness: 0.7 })));
  root.add(gantry(track, theme, night));
  return root;
}

// ---------------------------------------------------------------- barriers
export function buildBarriers(track: Track, l: ThemeLook, q: GfxQuality, night: boolean) {
  const root = new THREE.Group();
  const d0 = track.halfWidth + track.shoulder + 0.2;
  const k = l.barrier.kind, color = l.barrier.color;
  const tex = TX.barrier(k, color);
  const both = (prof: [number, number][], o: Parameters<typeof sweep>[2] = {}) => {
    const right = prof.map(([d, y]) => [d0 + d, y] as [number, number]);
    const left = prof.map(([d, y]) => [-(d0 + d), y] as [number, number]).reverse();
    return mergeGeometries([sweep(track, left, { ...o, flipV: true }), sweep(track, right, o)]);
  };
  const std = (o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, envMapIntensity: 0.6, ...o });
  const add = (g: THREE.BufferGeometry, m: THREE.Material, shadow = true) => { const mesh = new THREE.Mesh(g, m); mesh.name = `barrier:${k}`; mesh.receiveShadow = q !== "low"; mesh.castShadow = shadow && q === "high"; root.add(mesh); return mesh; };
  const wall = (h: number, o: Parameters<typeof sweep>[2] = {}) => both([[0, 0], [0, h]], o);
  switch (k) {
    case "rail": add(wall(0.95, { uScale: 4 }), std({ roughness: 0.35, metalness: 0.6, alphaTest: 0.5, side: THREE.DoubleSide, transparent: false })); break;
    case "concrete": add(both([[-0.32, 0], [-0.28, 0.22], [-0.12, 0.92], [0.12, 0.92], [0.28, 0.22], [0.32, 0]], { uScale: 4 }), std()); break;
    case "tires": add(both([[-0.45, 0], [-0.5, 0.35], [-0.42, 0.75], [-0.2, 0.98], [0.2, 0.98], [0.42, 0.75], [0.5, 0.35], [0.45, 0]], { uScale: 3 }), std({ roughness: 0.9 })); break;
    case "neon": case "glass": {
      const m = std({ emissiveMap: tex, emissive: new THREE.Color("#ffffff"), emissiveIntensity: night ? 1.4 : 0.7, side: THREE.DoubleSide, transparent: k === "glass", opacity: k === "glass" ? 0.85 : 1, alphaTest: k === "glass" ? 0 : 0.5, roughness: 0.2 });
      add(wall(k === "glass" ? 1.5 : 1.05, { uScale: 4 }), m, false);
      break;
    }
    case "fence": case "iron": {
      add(both([[-0.28, 0], [-0.22, 0.5], [0.22, 0.5], [0.28, 0]], { uScale: 4 }), new THREE.MeshStandardMaterial({ color: k === "iron" ? "#5A5650" : "#B8BCC2", roughness: 0.9 }));
      add(wall(k === "fence" ? 2.6 : 1.3, { uScale: 4 }).translate(0, 0.5, 0), std({ alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.5 }), false);
      break;
    }
    case "wood": case "bamboo": add(wall(1.25, { uScale: 4 }), std({ alphaTest: 0.5, side: THREE.DoubleSide })); break;
    case "candy": {
      add(both([[0, 0.56], [-0.2, 0.66], [-0.2, 0.9], [0, 1.0], [0.2, 0.9], [0.2, 0.66], [0, 0.56]], { uScale: 2.5, every: 3 }), std({ roughness: 0.25, emissiveMap: tex, emissive: new THREE.Color("#ffffff"), emissiveIntensity: night ? 0.6 : 0.12 }));
      add(both([[0, 0], [0, 0.6]], { uScale: 2.5, every: 3 }), new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.4, side: THREE.DoubleSide }), false);
      break;
    }
    case "ice": add(both([[-0.6, 0], [-0.5, 0.6], [-0.25, 1.0], [0.25, 1.05], [0.55, 0.6], [0.7, 0]], { uScale: 5, noise: 0.25 }), std({ roughness: 0.15, metalness: 0.1, envMapIntensity: 1.3, emissive: new THREE.Color(color), emissiveIntensity: 0.18, transparent: true, opacity: 0.88 })); break;
    case "snowbank": add(both([[-0.9, 0], [-0.6, 0.55], [-0.1, 0.85], [0.4, 0.7], [0.9, 0]], { uScale: 6, noise: 0.3 }), std({ roughness: 0.75 })); break;
    case "hedge": add(both([[-0.55, 0], [-0.6, 0.9], [-0.42, 1.25], [0.42, 1.25], [0.6, 0.9], [0.55, 0]], { uScale: 3, noise: 0.15 }), std({ roughness: 1 })); break;
    case "hay": add(both([[-0.55, 0], [-0.6, 0.85], [-0.45, 1.0], [0.45, 1.0], [0.6, 0.85], [0.55, 0]], { uScale: 2.4 }), std({ roughness: 1 })); break;
    case "stone": add(both([[-0.45, 0], [-0.4, 0.95], [-0.3, 1.05], [0.3, 1.05], [0.4, 0.95], [0.45, 0]], { uScale: 4 }), std({ roughness: 0.95 })); break;
    default: add(both([[-0.8, 0], [-0.65, 0.6], [-0.3, 1.05], [0.2, 1.1], [0.6, 0.65], [0.85, 0]], { uScale: 5, noise: 0.45 }), std({ roughness: 1, flatShading: true }));
  }
  return root;
}

// ---------------------------------------------------------------- start gantry
function gantry(track: Track, theme: ThemeSpec, night: boolean) {
  const g = new THREE.Group();
  const hw = track.halfWidth + 1.6;
  const p = track.point(0, 0), h = track.heading(0);
  g.position.copy(p); g.rotation.y = h;
  const parts: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    for (const z of [-0.6, 0.6]) parts.push(P(new THREE.BoxGeometry(0.35, 9, 0.35).translate(s * hw, 4.5, z), "#2a2f3a"));
    for (let y = 1; y < 9; y += 1.2) parts.push(P(new THREE.BoxGeometry(0.12, 0.12, 1.2).translate(s * hw, y, 0), "#3a404c"));
  }
  parts.push(P(new THREE.BoxGeometry(hw * 2 + 0.8, 0.5, 1.6).translate(0, 9.1, 0), "#2a2f3a"));
  for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) parts.push(P(new THREE.SphereGeometry(0.22, 8, 6).translate(-1.6 + i * 0.8, 6.45 - j * 0.5, 0.42), j ? "#300808" : "#FF2A2A", 0, j ? 0 : 1.6));
  parts.push(P(new THREE.BoxGeometry(4.2, 1.3, 0.4).translate(0, 6.2, 0.2), "#111317"));
  const frame = new THREE.Mesh(merge(parts), propMat({}));
  frame.castShadow = true;
  g.add(frame);
  const bt = TX.banner(theme.name, theme.accent);
  const banner = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 0.7, 1.8, 0.5), new THREE.MeshStandardMaterial({ map: bt, emissiveMap: bt, emissive: new THREE.Color("#ffffff"), emissiveIntensity: night ? 0.7 : 0.15, roughness: 0.6 }));
  banner.position.set(0, 7.9, 0); banner.castShadow = true;
  g.add(banner);
  return g;
}

// ---------------------------------------------------------------- overhead arches (instanced)
function archGeometry(kind: OverheadKind, W: number, c1: string, c2: string, night: boolean) {
  const parts: THREE.BufferGeometry[] = [];
  const B = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
  const Cy = (r1: number, r2: number, h: number, s = 8) => new THREE.CylinderGeometry(r1, r2, h, s);
  const legs = (h: number, r: number, col: string, sides = 8) => { for (const s of [-1, 1]) parts.push(P(Cy(r, r * 1.1, h + 6, sides).translate(s * W, (h - 6) / 2, 0), col)); };
  const rope = (y: number, sag: number, r: number, col: string, n = 16) => {
    for (let i = 0; i < n; i++) {
      const x0 = -W + (2 * W * i) / n, x1 = -W + (2 * W * (i + 1)) / n;
      const y0 = y - sag * (1 - (x0 / W) ** 2), y1 = y - sag * (1 - (x1 / W) ** 2);
      const len = Math.hypot(x1 - x0, y1 - y0);
      parts.push(P(Cy(r, r, len, 4).rotateZ(Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2).translate((x0 + x1) / 2, (y0 + y1) / 2, 0), col));
    }
    return (x: number) => y - sag * (1 - (x / W) ** 2);
  };
  const halfRing = (R: number, t: number, col: string, glow = 0, y = 0, seg = 20) => parts.push(P(new THREE.TorusGeometry(R, t, 6, seg, Math.PI).translate(0, y, 0), col, 0, glow));
  switch (kind) {
    case "gantry": {
      for (const s of [-1, 1]) for (const z of [-0.5, 0.5]) parts.push(P(B(0.3, 14, 0.3).translate(s * W, 1, z), "#5a606c"));
      parts.push(P(B(2 * W + 0.6, 1.2, 1.2).translate(0, 7.6, 0), "#3a404c"));
      parts.push(P(B(W * 1.2, 2.2, 0.3).translate(0, 6.0, 0.3), c1, 0, night ? 0.6 : 0));
      parts.push(P(B(W * 1.1, 0.4, 0.32).translate(0, 6.0, 0.32), "#FFFFFF", 0, night ? 1.2 : 0.2));
      break;
    }
    case "torii": {
      legs(8.5, 0.5, c1, 10);
      const top = B(2 * W + 4, 0.7, 1.2).translate(0, 9.2, 0); const p = top.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + (p.getX(i) / (W + 2)) ** 2 * 0.6);
      parts.push(P(top, "#1A1A1E"), P(B(2 * W + 3, 0.6, 0.9).translate(0, 8.5, 0), c1), P(B(2 * W + 1.2, 0.5, 0.6).translate(0, 7.0, 0), c1), P(B(0.5, 1.5, 0.5).translate(0, 7.8, 0), c1));
      break;
    }
    case "neon": {
      for (const [r, col] of [[0, c1], [0.6, c2]] as const) {
        const w = W - r, h = 9 - r;
        for (const s of [-1, 1]) parts.push(P(B(0.25, h + 4, 0.25).translate(s * w, (h - 4) / 2, 0), col, 0, 2.2));
        parts.push(P(B(2 * w, 0.25, 0.25).translate(0, h, 0), col, 0, 2.2));
      }
      break;
    }
    case "candy": for (let i = 0; i < 12; i++) parts.push(P(new THREE.TorusGeometry(W, 0.55, 8, 3, Math.PI / 12).rotateZ((i * Math.PI) / 12), i % 2 ? "#FFFFFF" : c1, 0, night ? 0.3 : 0)); legs(0, 0.55, "#FFFFFF"); break;
    case "rainbow": ["#FF4F6D", "#FF9F40", "#FFE14A", "#5BE37A", "#4FC3FF", "#9B6BFF"].forEach((col, i) => halfRing(W + 0.9 * (5 - i), 0.45, col, 0.8, 0, 24)); break;
    case "ice": { const g = new THREE.TorusGeometry(W, 1.3, 6, 16, Math.PI); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const h = Math.sin(i * 12.9898) * 43758.5453; p.setXYZ(i, p.getX(i) * (1 + (h - Math.floor(h) - 0.5) * 0.05), p.getY(i), p.getZ(i)); } parts.push(P(g, "#BFEFFF", 0, 0.25)); legs(0, 1.3, "#BFEFFF"); break; }
    case "stone": {
      for (const s of [-1, 1]) parts.push(P(Cy(1.2, 2.2, 15, 4).rotateY(Math.PI / 4).scale(1.6, 1, 0.8).translate(s * (W + 1), 1.5, 0), "#D9BE86"));
      parts.push(P(B(2 * W + 5, 1.6, 2.2).translate(0, 9.8, 0), "#CFB27A"), P(B(2 * W + 4.6, 0.5, 2.3).translate(0, 9.0, 0), "#2F6FB0"), P(B(2.6, 1.2, 0.3).translate(0, 9.8, 1.2), "#F2C230"));
      break;
    }
    case "lanterns": {
      legs(8, 0.25, "#4A3A2A", 6);
      const at = rope(8, 1.6, 0.05, "#2a2a2a");
      for (let i = 1; i < 8; i++) { const x = -W + (2 * W * i) / 8; parts.push(P(new THREE.SphereGeometry(0.45, 8, 6).scale(1, 1.25, 1).translate(x, at(x) - 0.8, 0), c1, 0, night ? 2.2 : 0.5)); parts.push(P(Cy(0.2, 0.2, 0.15, 6).translate(x, at(x) - 0.2, 0), "#2a2a2a")); }
      break;
    }
    case "bunting": {
      legs(7, 0.18, "#8a7a6a", 6);
      for (const [y, sag] of [[7, 1.4], [6.4, 1.0]] as const) {
        const at = rope(y, sag, 0.03, "#eeeeee");
        const cols = ["#E8504F", "#FFD25A", "#3B82F6", "#2FA866", "#FF8AC2", "#FFFFFF"];
        for (let i = 0; i < 18; i++) { const x = -W + (2 * W * (i + 0.5)) / 18; const tri = new THREE.ConeGeometry(0.35, 0.8, 3).rotateX(Math.PI).scale(1, 1, 0.15).translate(x, at(x) - 0.45, 0); parts.push(P(tri, cols[i % cols.length])); }
      }
      break;
    }
    case "vines": {
      for (const s of [-1, 1]) parts.push(P(Cy(0.6, 1.0, 20, 7).translate(s * (W + 0.5), 4, 0), "#5A4A36"));
      const at = rope(11, 2.2, 0.18, "#3E6A2A", 12);
      for (let i = 0; i < 16; i++) { const x = -W + (2 * W * (i + 0.5)) / 16; const len = 1.5 + ((i * 7) % 5) * 0.6; parts.push(P(B(0.08, len, 0.08).translate(x, at(x) - len / 2, (i % 3) * 0.2 - 0.2), "#4A8A34")); parts.push(P(new THREE.IcosahedronGeometry(0.45, 0).translate(x, at(x) - len, 0), "#3E7A2E")); }
      for (let i = 0; i < 10; i++) { const x = -W + (2 * W * i) / 9; parts.push(P(new THREE.IcosahedronGeometry(1.1, 0).scale(1.4, 0.7, 1).translate(x, at(x) + 0.3, 0), "#3A7A2A")); }
      break;
    }
    case "bridge": {
      for (const s of [-1, 1]) parts.push(P(B(1.6, 16, 2.6).translate(s * (W + 1.5), 1.5, 0), "#9A9EA6"));
      parts.push(P(B(2 * W + 10, 1.8, 9).translate(0, 10.4, 0), "#A8ACB4"), P(B(2 * W + 10, 0.2, 9.1).translate(0, 9.4, 0), "#6a6e76"));
      for (const z of [-4.4, 4.4]) parts.push(P(B(2 * W + 10, 1.1, 0.2).translate(0, 11.8, z), "#C9CED6"));
      for (let i = 0; i < 6; i++) parts.push(P(B(0.6, 0.15, 0.4).translate(-W + (i * 2 * W) / 5, 9.35, 0), "#FFF2C0", 0, night ? 2 : 0));
      break;
    }
    case "girder": {
      for (const s of [-1, 1]) for (const z of [-0.8, 0.8]) parts.push(P(B(0.4, 16, 0.4).translate(s * W, 2, z), "#C9CED6"));
      parts.push(P(B(2 * W + 1, 0.4, 0.4).translate(0, 10, 0.8), "#C9CED6"), P(B(2 * W + 1, 0.4, 0.4).translate(0, 10, -0.8), "#C9CED6"), P(B(2 * W + 1, 0.4, 0.4).translate(0, 8.2, 0), "#C9CED6"));
      for (let i = 0; i < 10; i++) { const x = -W + (2 * W * (i + 0.5)) / 10; parts.push(P(B(0.15, 2.4, 0.15).rotateZ(i % 2 ? 0.6 : -0.6).translate(x, 9.1, 0), "#9aa0aa")); }
      parts.push(P(B(2 * W * 0.8, 0.25, 0.3).translate(0, 8.0, 0.4), "#9FE8FF", 0, 2));
      break;
    }
    case "ranch": {
      legs(7, 0.35, "#6A4A2E", 7);
      parts.push(P(Cy(0.3, 0.3, 2 * W + 2, 7).rotateZ(Math.PI / 2).translate(0, 7.4, 0), "#6A4A2E"), P(B(7, 1.6, 0.25).translate(0, 6.0, 0), "#8A5A36"), P(B(6.4, 1.1, 0.27).translate(0, 6.0, 0), "#C9A06A"));
      parts.push(P(B(1.2, 1.0, 0.3).translate(0, 8.4, 0), "#EDE6D6"));
      break;
    }
    case "iron": {
      legs(6, 0.3, "#1E1E24", 6);
      halfRing(W, 0.12, "#1E1E24", 0, 6, 24);
      for (let i = 0; i < 14; i++) { const a = (i / 13) * Math.PI; parts.push(P(new THREE.ConeGeometry(0.12, 0.8, 4).translate(Math.cos(a) * W, 6 + Math.sin(a) * W + 0.3, 0), "#1E1E24")); }
      for (const s of [-1, 1]) parts.push(P(new THREE.BoxGeometry(0.5, 0.7, 0.5).translate(s * W, 6.6, 0.4), "#FFB45A", 0, -2.4));
      break;
    }
  }
  return merge(parts);
}

export function buildOverheads(track: Track, l: ThemeLook, night: boolean, rnd: () => number, avoid: [number, number][]) {
  const o = l.overhead;
  if (!o) return null;
  const W = track.halfWidth + track.shoulder + 1.0;
  const geo = archGeometry(o.kind, W, o.color ?? "#E5483A", o.color2 ?? "#4FF0FF", night);
  const L = track.length, list: number[] = [];
  for (let s = 70 + rnd() * o.every * 0.5; s < L - 50; s += o.every * (0.75 + rnd() * 0.5)) if (!avoid.some(([a, b]) => s > a - 20 && s < b + 20)) list.push(s);
  if (!list.length) return null;
  const inst = new THREE.InstancedMesh(geo, propMat({ side: THREE.DoubleSide }), list.length);
  const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  list.forEach((s, i) => { track.point(s, 0, p); qq.setFromAxisAngle(up, track.heading(s)); m4.compose(p, qq, one); inst.setMatrixAt(i, m4); });
  inst.instanceMatrix.needsUpdate = true;
  inst.computeBoundingSphere();
  inst.castShadow = true;
  return inst;
}

// ---------------------------------------------------------------- tunnels & galleries
export function pickTunnelRanges(track: Track, count: number, length: number, rnd: () => number): [number, number][] {
  const out: [number, number][] = [];
  const L = track.length;
  for (let tries = 0; out.length < count && tries < 60; tries++) {
    const s0 = 120 + rnd() * (L - 240 - length);
    if (s0 < 0) break;
    if (out.some(([a, b]) => s0 < b + 120 && s0 + length > a - 120)) continue;
    out.push([s0, s0 + length]);
  }
  return out;
}

export function buildTunnels(track: Track, l: ThemeLook, ranges: [number, number][], q: GfxQuality, night: boolean) {
  const t = l.tunnels;
  if (!t || !ranges.length) return null;
  const root = new THREE.Group();
  const W = track.halfWidth + track.shoulder + 1.3, H = 9.5;
  const arc = (rw: number, rh: number, n = 12, from = 0, to = Math.PI) => Array.from({ length: n + 1 }, (_, i) => { const a = from + ((to - from) * i) / n; return [Math.cos(a) * rw, Math.sin(a) * rh] as [number, number]; });
  const tunnelTex = tunnelTexture(t.kind);
  for (const [a, b] of ranges) {
    if (t.kind === "neon") continue;
    if (t.kind === "gallery") {
      // avalanche gallery: roof slab, solid wall on one side, pillars on the other
      const roof = sweep(track, [[-W - 1.5, 7.2], [-W - 1.5, 8.6], [W + 1.5, 8.6], [W + 1.5, 7.2], [-W - 1.5, 7.2]], { sMin: a, sMax: b, every: 2, uScale: 6, caps: true });
      const wall = sweep(track, [[-W - 1.5, -1], [-W - 1.5, 7.3], [-W - 0.3, 7.3], [-W - 0.3, -1]], { sMin: a, sMax: b, every: 2, uScale: 6, caps: true });
      const m = new THREE.Mesh(mergeGeometries([roof.index ? roof.toNonIndexed() : roof, wall.index ? wall.toNonIndexed() : wall]), new THREE.MeshStandardMaterial({ map: TX.barrier("concrete", "#B8B4AC"), color: "#cfcac0", roughness: 0.9, side: THREE.DoubleSide }));
      m.castShadow = q !== "low"; m.receiveShadow = q !== "low"; root.add(m);
      const snowTop = sweep(track, [[-W - 1.8, 8.5], [-W + 2, 9.6], [W - 2, 9.6], [W + 1.8, 8.5]], { sMin: a, sMax: b, every: 2, uScale: 6 });
      root.add(new THREE.Mesh(snowTop, new THREE.MeshStandardMaterial({ color: "#F4F8FF", roughness: 0.8 })));
      const n = Math.floor((b - a) / 8), pg = new THREE.BoxGeometry(0.8, 9, 0.8).translate(0, 3.5, 0);
      const pil = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ color: "#B8B4AC", roughness: 0.9 }), n);
      const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < n; i++) { const s = a + 4 + i * 8; track.point(s, W + 0.9, p); qq.setFromAxisAngle(up, track.heading(s)); m4.compose(p, qq, one); pil.setMatrixAt(i, m4); }
      pil.computeBoundingSphere(); pil.castShadow = q !== "low"; root.add(pil);
      continue;
    }
    // closed tunnel: lit inner lining + rough outer shell + portals
    const innerG = sweep(track, arc(W, H, 14), { sMin: a, sMax: b, every: 2, uScale: 6 });
    const glass = t.kind === "glass", ice = t.kind === "ice";
    const innerMat = new THREE.MeshStandardMaterial({
      map: tunnelTex.map, emissiveMap: tunnelTex.glow, emissive: new THREE.Color(glass ? "#9FF6FF" : "#FFF0C8"), emissiveIntensity: glass ? 0.6 : 1.0,
      roughness: glass || ice ? 0.15 : 0.85, metalness: glass ? 0.2 : 0, side: THREE.DoubleSide,
      transparent: glass || ice, opacity: glass ? 0.32 : ice ? 0.78 : 1, depthWrite: !(glass || ice), envMapIntensity: glass || ice ? 1.4 : 0.4,
      color: glass ? new THREE.Color("#BFF6FF") : ice ? new THREE.Color("#BFE8FF") : new THREE.Color("#ffffff"),
    });
    const im = new THREE.Mesh(innerG, innerMat); im.receiveShadow = q !== "low"; root.add(im);
    if (!glass) {
      const outerG = sweep(track, [[-W - 0.4, -1.5], ...arc(W + 2.2, H + 2.6, 14).reverse(), [W + 0.4, -1.5]] as [number, number][], { sMin: a, sMax: b, every: 2, uScale: 8, noise: t.kind === "rock" || ice ? 0.9 : 0, caps: true });
      const om = new THREE.Mesh(outerG, new THREE.MeshStandardMaterial({ map: TX.barrier(t.kind === "concrete" ? "concrete" : ice ? "ice" : "rocks", t.kind === "concrete" ? "#A8A49C" : ice ? "#9ADCF5" : l.ground.rock ?? l.ground.mountain), roughness: ice ? 0.3 : 0.95, flatShading: t.kind === "rock", transparent: ice, opacity: ice ? 0.9 : 1 }));
      om.castShadow = q !== "low"; root.add(om);
    }
    // ribs every 7 m (glass tubes) or portal frames at the ends
    const ribS: number[] = glass ? Array.from({ length: Math.floor((b - a) / 7) + 1 }, (_, i) => a + i * 7) : [a, b];
    const ribG = merge([P(new THREE.TorusGeometry(W + 0.2, glass ? 0.25 : 0.6, 6, 20, Math.PI).scale(1, H / W, 1), glass ? "#D8E0E6" : "#8A8680")]);
    const rib = new THREE.InstancedMesh(ribG, propMat({}), ribS.length);
    const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
    ribS.forEach((s, i) => { track.point(s, 0, p); qq.setFromAxisAngle(up, track.heading(s)); m4.compose(p, qq, one); rib.setMatrixAt(i, m4); });
    rib.computeBoundingSphere(); root.add(rib);
  }
  void night;
  return root;
}

function tunnelTexture(kind: string) {
  const map = TX.canvasTex(`tunnel:${kind}`, 256, 128, (g, w, h) => {
    const base = kind === "glass" ? "#9FDCEB" : kind === "ice" ? "#CFEFFF" : kind === "rock" ? "#6A625C" : "#B8B4AC";
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { g.fillStyle = Math.random() < 0.5 ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)"; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
    if (kind === "concrete" || kind === "rock") { g.fillStyle = "rgba(0,0,0,0.25)"; for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 2, h); g.fillStyle = "#E8E4DA"; g.fillRect(0, h * 0.08, w, h * 0.08); g.fillRect(0, h * 0.84, w, h * 0.08); }
    g.fillStyle = "#FFF6D8"; for (let x = 8; x < w; x += 64) g.fillRect(x, h * 0.48, 40, h * 0.05);
  });
  const glow = TX.canvasTex(`tunnel:${kind}:glow`, 256, 128, (g, w, h) => { g.fillStyle = "#000"; g.fillRect(0, 0, w, h); g.fillStyle = "#FFFFFF"; for (let x = 8; x < w; x += 64) g.fillRect(x, h * 0.48, 40, h * 0.05); });
  return { map, glow };
}

// ---------------------------------------------------------------- lamps with fake light pools
export function buildLamps(track: Track, l: ThemeLook, night: boolean, q: GfxQuality, avoid: [number, number][]) {
  const lp = l.lamps;
  if (!lp) return null;
  const root = new THREE.Group();
  const hw = track.halfWidth, d0 = hw + track.shoulder + 0.9;
  const kind: LampKind = lp.kind, glowK = night ? 1 : kind === "torch" || kind === "lantern" || kind === "neon" ? 0.3 : 0;
  const every = q === "low" ? lp.every * 1.4 : lp.every;
  const pts: { s: number; side: number }[] = [];
  let side = 1;
  for (let s = 20; s < track.length - 10; s += every) { if (avoid.some(([a, b]) => s > a && s < b)) continue; pts.push({ s, side }); side = -side; }
  const head = new THREE.Vector3();
  let geo: THREE.BufferGeometry;
  const g = -2.5;
  switch (kind) {
    case "lantern": geo = merge([P(new THREE.CylinderGeometry(0.08, 0.1, 3.2, 6).translate(0, 1.6, 0), "#2a2a2e"), P(new THREE.BoxGeometry(0.9, 0.08, 0.08).translate(0, 3.1, 0.4), "#2a2a2e"), P(new THREE.BoxGeometry(0.42, 0.6, 0.42).translate(0, 2.7, 0.8), lp.color, 0, g), P(new THREE.ConeGeometry(0.4, 0.3, 4).rotateY(Math.PI / 4).translate(0, 3.15, 0.8), "#2a2a2e")]); head.set(0, 2.7, 0.8); break;
    case "torch": geo = merge([P(new THREE.CylinderGeometry(0.1, 0.14, 3, 5).translate(0, 1.5, 0), "#5A4030"), P(new THREE.CylinderGeometry(0.35, 0.2, 0.4, 6).translate(0, 3.1, 0), "#3a3030"), P(new THREE.ConeGeometry(0.3, 0.8, 5).translate(0, 3.6, 0), "#FF9A30", 0, 2.5)]); head.set(0, 3.6, 0); break;
    case "flood": geo = merge([P(new THREE.CylinderGeometry(0.15, 0.25, 12, 6).translate(0, 6, 0), "#9aa0aa"), P(new THREE.BoxGeometry(2.4, 1.2, 0.4).rotateX(0.5).translate(0, 12, 0.6), "#3a3f47"), P(new THREE.BoxGeometry(2.0, 0.9, 0.1).rotateX(0.5).translate(0, 11.95, 0.85), lp.color, 0, g)]); head.set(0, 11.9, 1.0); break;
    case "neon": geo = merge([P(new THREE.CylinderGeometry(0.1, 0.1, 6, 6).translate(0, 3, 0), lp.color, 0, 2)]); head.set(0, 5.5, 0); break;
    default: geo = merge([P(new THREE.CylinderGeometry(0.09, 0.15, 8, 6).translate(0, 4, 0), "#3a3f47"), P(new THREE.BoxGeometry(0.12, 0.12, 2.6).translate(0, 8, 1.2), "#3a3f47"), P(new THREE.BoxGeometry(0.4, 0.16, 0.9).translate(0, 7.88, 2.4), lp.color, 0, g)]); head.set(0, 7.8, 2.4);
  }
  const inst = new THREE.InstancedMesh(geo, propMat({ lambert: q === "low" }), pts.length);
  const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0), hp = new THREE.Vector3();
  const halo = new Float32Array(pts.length * 3);
  const pools: THREE.BufferGeometry[] = [];
  pts.forEach(({ s, side }, i) => {
    track.point(s, side * d0, p);
    qq.setFromAxisAngle(up, track.heading(s) + (side > 0 ? Math.PI / 2 : -Math.PI / 2));
    m4.compose(p, qq, one); inst.setMatrixAt(i, m4);
    hp.copy(head).applyQuaternion(qq).add(p); halo.set([hp.x, hp.y, hp.z], i * 3);
    if (glowK > 0 && kind !== "neon") {
      const dl = side * (d0 - head.z), r = kind === "flood" ? 11 : kind === "street" ? 8 : 4.5;
      pools.push(track.ribbon(Math.max(-hw - track.shoulder, dl - r), Math.min(hw + track.shoulder, dl + r), { lift: 0.06, vScale: r * 2, sMin: s - r, sMax: s + r }));
    }
  });
  inst.instanceMatrix.needsUpdate = true; inst.computeBoundingSphere();
  inst.castShadow = q === "high";
  root.add(inst);
  if (glowK > 0) {
    const col = new THREE.Color(lp.color);
    const hg = new THREE.BufferGeometry(); hg.setAttribute("position", new THREE.BufferAttribute(halo, 3));
    const hm = new THREE.PointsMaterial({ color: col.clone().multiplyScalar(0.9 * glowK), size: kind === "flood" ? 9 : kind === "street" ? 6 : 3.5, map: TX.glowSprite(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    root.add(new THREE.Points(hg, hm));
    if (pools.length) {
      // each pool ribbon spans v 0..1 along and u 0..1 across, matching the radial pool texture
      const pm = new THREE.MeshBasicMaterial({ map: TX.lightPool(), color: col.clone().multiplyScalar(0.55 * glowK), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      root.add(new THREE.Mesh(mergeGeometries(pools), pm));
    }
  }
  return root;
}

/** keep the shared prop clock in one place */
export function tickProps(dt: number) { PROP_UNIFORMS.uTime.value += dt; }
