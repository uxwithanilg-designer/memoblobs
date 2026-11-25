// Every prop and horizon landmark of Wake Racers, modelled in code from primitives (no files to download): palms and
// beach huts on stilts, lighthouses, snowy pines, temple ruins in the jungle, pastel canal houses with lit windows,
// pagodas and blossom trees, lava vents, sandstone arches and mesas, glass towers with window grids, neon towers and
// holograms, harbour cranes and containers, crystals and glowing mushrooms, wind turbines, shipwrecks, sea stacks…
// and on the horizon: snowy ranges, mesas, smoking volcanoes, city skylines, jungle hills, islands, dunes, cliffs.
// Each kind may come in a few variants (colours, shapes); the scene draws each variant as one instanced mesh.
import type * as THREE from "three";
import { part, merge, box, cyl, cone, ball, sphere, lathe, rock, torus, extrude } from "./kit";
import type { FarKind, PropKind, World } from "../worlds";
import { shade, mix } from "../util";

type G = THREE.BufferGeometry;
const PASTEL = ["#F4A6A6", "#F6D186", "#A8D8EA", "#C3AED6", "#FFD3B6", "#B5EAD7", "#FFB7C5"];

function windows(w: number, h: number, d: number, rows: number, cols: number, lit: string, frame: string, glow = 0.5): G[] {
  // a grid of window panes on the front and back faces
  const out: G[] = [];
  const pw = (w / cols) * 0.55, ph = (h / rows) * 0.5;
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const x = -w / 2 + (w / cols) * (k + 0.5), y = (h / rows) * (r + 0.5);
    const on = ((r * 7 + k * 13) % 5) !== 0;
    for (const zf of [1, -1]) out.push(part(box(pw, ph, 0.08), on ? lit : frame, { p: [x, y, zf * (d / 2 + 0.02)], glow: on ? glow : 0 }));
  }
  return out;
}

const builders: Record<PropKind, (w: World, v: number) => G> = {
  palm: (_w, v) => {
    const parts: G[] = [];
    // a curved trunk of stacked rings, leaning
    const lean = 0.25 + v * 0.2;
    for (let i = 0; i < 7; i++) parts.push(part(cyl(0.28 - i * 0.02, 0.32 - i * 0.02, 1.25, 6), i % 2 ? "#8B6A45" : "#9E7B50", { p: [lean * i * i * 0.12, 0.6 + i * 1.15, 0], r: [0, 0, -lean * i * 0.09] }));
    const tx = lean * 36 * 0.12, ty = 8.3;
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + v;
      parts.push(part(box(0.9, 0.08, 3.6), k % 2 ? "#3FA34D" : "#4FBF5A", { p: [tx + Math.sin(a) * 1.6, ty - 0.45, Math.cos(a) * 1.6], r: [0.45, a, 0] }));
    }
    parts.push(part(ball(0.32, 0), "#6B4A2A", { p: [tx + 0.3, ty - 0.4, 0.2] }), part(ball(0.3, 0), "#6B4A2A", { p: [tx - 0.25, ty - 0.45, -0.2] }));
    return merge(parts);
  },
  hut: (_w, v) => merge([
    ...[-1.6, 1.6].flatMap((x) => [-1.4, 1.4].map((z) => part(cyl(0.14, 0.14, 3.2, 5), "#7A5A3A", { p: [x, 0.4, z] }))),
    part(box(4, 0.25, 3.6), "#A07A50", { p: [0, 2, 0] }),
    part(box(3.4, 2, 3), v > 0.5 ? "#F2D9A8" : "#E8C690", { p: [0, 3.1, 0] }),
    part(cone(3.2, 2.2, 4), "#C9A25A", { p: [0, 5.2, 0], r: [0, Math.PI / 4, 0] }),
    part(box(0.9, 1.3, 0.1), "#5A3A2A", { p: [0, 2.8, 1.52] }),
    part(box(0.7, 0.6, 0.08), "#FFE6A0", { p: [1.1, 3.3, 1.52], glow: 0.5 }),
  ]),
  parasol: (_w, v) => merge([
    part(cyl(0.06, 0.06, 2.6, 5), "#FFFFFF", { p: [0, 1.3, 0] }),
    part(cone(1.6, 0.6, 8), v > 0.5 ? "#FF6B6B" : "#FFD23F", { p: [0, 2.7, 0] }),
    part(box(0.7, 0.12, 1.8), "#FFFFFF", { p: [1, 0.25, 0.4], r: [0, 0.3, 0] }),
  ]),
  lighthouse: () => {
    const parts: G[] = [];
    for (let i = 0; i < 5; i++) parts.push(part(cyl(1.5 - i * 0.12, 1.62 - i * 0.12, 3, 12), i % 2 ? "#E03A3A" : "#FFFFFF", { p: [0, 1.5 + i * 3, 0] }));
    parts.push(part(cyl(1.15, 1.15, 0.3, 12), "#3A3A4A", { p: [0, 15.2, 0] }), part(cyl(0.9, 0.9, 1.6, 10), "#FFF6C8", { p: [0, 16.1, 0], glow: 1 }));
    parts.push(part(cone(1.2, 1.2, 10), "#E03A3A", { p: [0, 17.5, 0] }), part(cyl(2.4, 2.6, 1, 10), "#9A9A9A", { p: [0, 0.2, 0] }));
    return merge(parts);
  },
  boulder: (w, v) => merge([part(rock(1.6, v * 10, 1, 0.7), v > 0.5 ? w.land.high : w.land.mid, { p: [0, 0.5, 0] })]),
  bush: (w, v) => merge([
    part(ball(1.1, 1), shade(w.land.low, -0.15), { p: [0, 0.6, 0], s: [1, 0.8, 1] }),
    part(ball(0.8, 1), shade(w.land.low, 0.05), { p: [0.8, 0.5, 0.3], s: [1, 0.8, 1] }),
    part(ball(0.7, 0), v > 0.6 ? "#FF7AB0" : shade(w.land.low, -0.05), { p: [-0.6, 0.6, -0.4] }),
  ]),
  reeds: () => {
    const parts: G[] = [];
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4, r = 0.3 + (i % 3) * 0.35;
      parts.push(part(cyl(0.03, 0.05, 2.2 + (i % 4) * 0.4, 3), "#6E8A3A", { p: [Math.sin(a) * r, 1.1, Math.cos(a) * r], r: [Math.sin(a) * 0.15, 0, Math.cos(a) * 0.15] }));
      if (i % 2) parts.push(part(cyl(0.09, 0.09, 0.45, 5), "#6B4A2A", { p: [Math.sin(a) * r, 2.3 + (i % 4) * 0.3, Math.cos(a) * r] }));
    }
    return merge(parts);
  },
  lily: (_w, v) => merge([
    part(cyl(0.9, 0.9, 0.05, 10), "#3E8E41", { p: [0, 0.03, 0] }), part(cyl(0.6, 0.6, 0.05, 8), "#4FA85A", { p: [1.3, 0.03, 0.6] }),
    ...(v > 0.4 ? [part(cone(0.3, 0.35, 6), v > 0.7 ? "#FFB7D0" : "#FFFFFF", { p: [0.2, 0.2, 0.1] }), part(ball(0.1, 0), "#FFE066", { p: [0.2, 0.32, 0.1] })] : []),
  ]),
  pine: (_w, v) => merge([
    part(cyl(0.22, 0.3, 2, 6), "#6B4A2A", { p: [0, 1, 0] }),
    ...[0, 1, 2, 3].map((i) => part(cone(2.2 - i * 0.45, 2.4, 7), i % 2 ? "#2F6B45" : "#3A7D50", { p: [0, 2.4 + i * 1.5, 0], r: [0, i + v, 0] })),
  ]),
  snowpine: (_w, v) => merge([
    part(cyl(0.22, 0.3, 2, 6), "#5A3E28", { p: [0, 1, 0] }),
    ...[0, 1, 2, 3].flatMap((i) => [
      part(cone(2.2 - i * 0.45, 2.4, 7), "#2B5A48", { p: [0, 2.4 + i * 1.5, 0], r: [0, i + v, 0] }),
      part(cone(1.6 - i * 0.35, 1.1, 7), "#F4F8FF", { p: [0, 3.1 + i * 1.5, 0], r: [0, i + v, 0] }),
    ]),
  ]),
  iceberg: (_w, v) => merge([
    part(rock(3.2, v * 9, 1, 0.9), "#E8F6FF", { p: [0, 1.4, 0] }),
    part(rock(2, v * 7 + 3, 0, 1.4), "#BFE6FF", { p: [1.2, 3.4, 0.5] }),
    part(cyl(3.6, 3.9, 0.6, 9), "#8FD3F0", { p: [0, -0.1, 0] }),
  ]),
  roundtree: (w, v) => merge([
    part(cyl(0.2, 0.28, 2.2, 6), "#6B4A2A", { p: [0, 1.1, 0] }),
    part(ball(1.7, 1), shade(w.land.low, -0.1 + v * 0.1), { p: [0, 3.2, 0] }), part(ball(1.2, 1), shade(w.land.low, 0.05), { p: [0.9, 3.8, 0.4] }),
  ]),
  jungletree: (_w, v) => merge([
    part(cyl(0.35, 0.55, 9, 6), "#5A4028", { p: [0, 4.5, 0] }),
    ...[-1, 1].map((sx) => part(cyl(0.12, 0.18, 3, 5), "#5A4028", { p: [sx * 1, 7.5, 0], r: [0, 0, -sx * 0.7] })),
    part(ball(3, 1), "#2A7A34", { p: [0, 10, 0], s: [1.2, 0.6, 1.2] }), part(ball(2.2, 1), "#3E8E41", { p: [1.8, 9.2, 1], s: [1.1, 0.6, 1.1] }),
    part(ball(2, 1), "#1F5E2E", { p: [-1.6, 9.4, -0.8], s: [1.1, 0.6, 1.1] }),
    ...(v > 0.5 ? [part(cyl(0.04, 0.04, 6, 3), "#3E6E2A", { p: [1.6, 6, 1.4] }), part(cyl(0.04, 0.04, 5, 3), "#3E6E2A", { p: [-1.2, 6.5, -1] })] : []),
  ]),
  fern: (_w, v) => {
    const parts: G[] = [];
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + v; parts.push(part(box(0.5, 0.05, 2.2), k % 2 ? "#3E9E48" : "#2E8A3E", { p: [Math.sin(a) * 0.9, 0.55, Math.cos(a) * 0.9], r: [-0.55, a, 0] })); }
    return merge(parts);
  },
  pillar: (_w, v) => merge([
    part(box(1.6, 0.5, 1.6), "#8A8F7A", { p: [0, 0.25, 0] }),
    part(cyl(0.6, 0.65, 4 + v * 3, 8), "#9AA38C", { p: [0, 2.5 + v * 1.5, 0] }),
    part(box(1.5, 0.45, 1.5), "#8A8F7A", { p: [0, 4.75 + v * 3, 0] }),
    part(ball(0.7, 0), "#4E7A3A", { p: [0.5, 5.1 + v * 3, 0.3], s: [1, 0.5, 1] }),
  ]),
  ruin: () => merge([
    part(box(8, 1, 5), "#8A8F7A", { p: [0, 0.5, 0] }),
    part(box(1.2, 5, 1.2), "#9AA38C", { p: [-3, 3.5, 0] }), part(box(1.2, 4, 1.2), "#9AA38C", { p: [3, 3, 0] }),
    part(box(7.4, 1, 1.4), "#A8B09A", { p: [0, 6.3, 0], r: [0, 0, 0.08] }),
    part(ball(1.2, 0), "#3E7A3A", { p: [-3, 6.8, 0.4], s: [1.2, 0.5, 1] }),
  ]),
  temple: () => {
    const parts: G[] = [];
    for (let i = 0; i < 5; i++) parts.push(part(box(18 - i * 3.4, 3, 18 - i * 3.4), i % 2 ? "#9AA38C" : "#8A9078", { p: [0, 1.5 + i * 3, 0] }));
    parts.push(part(box(3, 3.5, 3), "#A8B09A", { p: [0, 16.7, 0] }), part(box(1.2, 1.8, 0.2), "#2A2A1A", { p: [0, 16.3, 1.52] }));
    parts.push(part(box(2.2, 14, 1), "#7A8068", { p: [0, 7, 8.6], r: [0.68, 0, 0] }));
    parts.push(part(ball(2.5, 1), "#3E7A3A", { p: [5, 5, 5], s: [1.5, 0.6, 1.2] }));
    return merge(parts);
  },
  house: (_w, v) => {
    const wall = PASTEL[Math.floor(v * PASTEL.length) % PASTEL.length], h = 7 + Math.floor(v * 3) * 2.2;
    return merge([
      part(box(5, h, 5), wall, { p: [0, h / 2, 0] }),
      part(box(5.3, 0.3, 5.3), shade(wall, -0.25), { p: [0, h, 0] }),
      part(extrude([[-2.8, 0], [2.8, 0], [0, 2.2]], 5.2), v > 0.5 ? "#B5483A" : "#8A4A3A", { p: [0, h + 0.1, 0] }),
      ...windows(5, h - 1.5, 5, Math.round(h / 2.4), 2, "#FFD98A", shade(wall, -0.35)).map((g) => { g.translate(0, 1.2, 0); return g; }),
      part(box(1.3, 2, 0.12), "#5A3A2A", { p: [0, 1, 2.56] }),
      part(box(5.2, 0.15, 0.9), "#FFFFFF", { p: [0, 3.2, 2.9] }),
    ]);
  },
  lamp: (w) => merge([
    part(cyl(0.08, 0.12, 4.2, 6), w.profile === "neon" ? "#2A2C4A" : "#2A2A2A", { p: [0, 2.1, 0] }),
    part(box(0.12, 0.12, 1.2), "#2A2A2A", { p: [0, 4.1, 0.5] }),
    part(sphere(0.32, 8, 6), w.profile === "neon" ? "#36E3FF" : "#FFE6A0", { p: [0, 3.9, 1], glow: w.profile === "neon" || w.profile === "cave" ? 1 : 0.5 }),
  ]),
  pagoda: () => {
    const parts: G[] = [];
    for (let i = 0; i < 5; i++) {
      const s = 7 - i * 1.15, y = i * 3.1;
      parts.push(part(box(s * 0.7, 2.4, s * 0.7), "#E8D8C0", { p: [0, y + 1.2, 0] }));
      parts.push(part(cyl(s * 0.75, s * 0.95, 0.7, 4), "#C0392B", { p: [0, y + 2.75, 0], r: [0, Math.PI / 4, 0] }));
      parts.push(part(box(s * 0.5, 0.6, 0.06), "#FFD27A", { p: [0, y + 1.4, s * 0.35 + 0.02], glow: 0.5 }));
    }
    parts.push(part(cyl(0.12, 0.12, 3, 5), "#D4A017", { p: [0, 17, 0] }));
    return merge(parts);
  },
  blossomtree: (_w, v) => merge([
    part(cyl(0.25, 0.4, 3, 6), "#6B3E36", { p: [0, 1.5, 0] }),
    part(cyl(0.12, 0.2, 2, 5), "#6B3E36", { p: [0.7, 3.2, 0], r: [0, 0, -0.6] }),
    part(ball(2.2, 1), v > 0.5 ? "#FFB7D0" : "#FF9EC4", { p: [0, 4.6, 0], s: [1.2, 0.85, 1.2] }),
    part(ball(1.5, 1), "#FFD1E2", { p: [1.5, 4.2, 0.6] }), part(ball(1.4, 1), "#FF8FB8", { p: [-1.3, 4.3, -0.6] }),
  ]),
  gate: () => merge([
    part(cyl(0.45, 0.5, 9, 8), "#E03A3A", { p: [-4.5, 4.5, 0] }), part(cyl(0.45, 0.5, 9, 8), "#E03A3A", { p: [4.5, 4.5, 0] }),
    part(box(12, 0.8, 1), "#1A1A1A", { p: [0, 9.2, 0] }), part(box(10.6, 0.6, 0.8), "#E03A3A", { p: [0, 7.8, 0] }),
    part(box(0.5, 1.4, 0.6), "#E03A3A", { p: [0, 8.5, 0] }),
  ]),
  stonelantern: () => merge([
    part(box(0.8, 0.3, 0.8), "#9A9A9A", { p: [0, 0.15, 0] }), part(cyl(0.2, 0.25, 1.2, 6), "#A8A8A8", { p: [0, 0.9, 0] }),
    part(box(0.9, 0.7, 0.9), "#A8A8A8", { p: [0, 1.85, 0] }), part(box(0.5, 0.4, 0.95), "#FFD98A", { p: [0, 1.85, 0], glow: 0.5 }),
    part(cone(0.85, 0.6, 4), "#8A8A8A", { p: [0, 2.5, 0], r: [0, Math.PI / 4, 0] }),
  ]),
  lavarock: (w, v) => merge([
    part(rock(1.8, v * 11, 1, 0.8), "#2B2626", { p: [0, 0.6, 0] }),
    part(rock(0.9, v * 5, 0, 1), w.land.glow ?? "#FF5A1F", { p: [0.4, 1.2, 0.5], glow: 1 }),
  ]),
  vent: () => merge([
    part(cone(2.4, 3.2, 8), "#3D3535", { p: [0, 1.6, 0] }),
    part(cyl(0.7, 0.9, 0.4, 8), "#FF6A2B", { p: [0, 3.1, 0], glow: 1 }),
  ]),
  cactus: (_w, v) => merge([
    part(cyl(0.38, 0.42, 4, 8), "#4E8A3E", { p: [0, 2, 0] }), part(sphere(0.38, 8, 4), "#4E8A3E", { p: [0, 4, 0] }),
    part(cyl(0.22, 0.24, 1.6, 6), "#4E8A3E", { p: [0.7, 2.2, 0], r: [0, 0, 0] }), part(cyl(0.22, 0.22, 0.6, 6), "#4E8A3E", { p: [0.45, 1.5, 0], r: [0, 0, Math.PI / 2] }),
    ...(v > 0.5 ? [part(cyl(0.2, 0.22, 1.2, 6), "#4E8A3E", { p: [-0.65, 2.8, 0] }), part(cyl(0.2, 0.2, 0.5, 6), "#4E8A3E", { p: [-0.4, 2.3, 0], r: [0, 0, Math.PI / 2] }), part(ball(0.18, 0), "#FF6B9A", { p: [0, 4.35, 0] })] : []),
  ]),
  mesa: (w, v) => merge([
    part(cyl(14, 18, 18 + v * 10, 7), (w.land.strata ?? [w.land.mid])[0], { p: [0, 9 + v * 5, 0] }),
    part(cyl(14.5, 14, 2, 7), (w.land.strata ?? [w.land.high])[2] ?? w.land.high, { p: [0, 18 + v * 10, 0] }),
    part(cyl(16, 18, 4, 7), (w.land.strata ?? [w.land.mid])[1] ?? w.land.mid, { p: [0, 6, 0] }),
  ]),
  arch: (w) => {
    const c1 = (w.land.strata ?? [w.land.high])[1] ?? w.land.high, c2 = (w.land.strata ?? [w.land.mid])[0] ?? w.land.mid;
    return merge([
      part(rock(5, 3, 1, 3), c1, { p: [-11, 8, 0] }), part(rock(5, 7, 1, 3), c2, { p: [11, 8, 0] }),
      part(torus(11, 3.2, 6, 14, Math.PI), c1, { p: [0, 14, 0] }),
    ]);
  },
  tower: (w, v) => {
    const h = 26 + Math.floor(v * 4) * 9, wd = 9;
    const body = w.profile === "neon" ? "#1A1C3A" : w.profile === "canal" ? "#C8B8A0" : v > 0.5 ? "#2E3A5A" : "#3A4466";
    const lit = w.profile === "canal" ? "#FFD98A" : v > 0.5 ? "#9AD8FF" : "#FFE6A0";
    return merge([
      part(box(wd, h, wd), body, { p: [0, h / 2, 0] }),
      ...windows(wd, h - 2, wd, Math.round(h / 3.2), 4, lit, shade(body, -0.3), 0.45),
      part(box(wd + 0.6, 1, wd + 0.6), shade(body, 0.15), { p: [0, h + 0.5, 0] }),
      ...(v > 0.6 ? [part(cyl(0.1, 0.1, 6, 4), "#888888", { p: [0, h + 3.5, 0] }), part(ball(0.3, 0), "#FF3B3B", { p: [0, h + 6.5, 0], glow: 1 })] : []),
    ]);
  },
  neontower: (_w, v) => {
    const h = 34 + Math.floor(v * 3) * 12, neon = ["#FF3DCB", "#36E3FF", "#B98CFF", "#3EE08F"][Math.floor(v * 4) % 4];
    return merge([
      part(box(10, h, 10), "#12142A", { p: [0, h / 2, 0] }),
      ...[0.25, 0.5, 0.75].map((f) => part(box(10.4, 0.4, 10.4), neon, { p: [0, h * f, 0], glow: 1 })),
      ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => part(box(0.3, h, 0.3), neon, { p: [sx * 5.1, h / 2, sz * 5.1], glow: 1 }))),
      ...windows(10, h - 4, 10, Math.round(h / 4), 3, "#9AF6FF", "#1A1C3A", 0.35),
      part(cone(3, 8, 4), neon, { p: [0, h + 4, 0], glow: 0.9 }),
    ]);
  },
  crane: () => merge([
    ...[-2, 2].flatMap((x) => [-2, 2].map((z) => part(box(0.5, 22, 0.5), "#FFB21F", { p: [x, 11, z] }))),
    part(box(5, 0.6, 5), "#FFB21F", { p: [0, 22, 0] }),
    part(box(2.2, 2.2, 3), "#E8E8E8", { p: [0, 23.4, 0] }),
    part(box(0.9, 0.9, 30), "#FFB21F", { p: [0, 25, 8] }), part(box(0.9, 0.9, 10), "#FFB21F", { p: [0, 25, -8] }),
    part(box(2.4, 2, 2.4), "#5A5A5A", { p: [0, 24, -12] }),
    part(cyl(0.05, 0.05, 12, 3), "#333333", { p: [0, 18.5, 20] }), part(box(1.4, 0.6, 1.4), "#E03A3A", { p: [0, 12.3, 20] }),
    part(ball(0.25, 0), "#FF3B3B", { p: [0, 25.6, 23], glow: 1 }),
  ]),
  containers: (_w, v) => {
    const cols = ["#E03A3A", "#2E9BFF", "#3EE08F", "#FFB21F", "#B98CFF", "#FF7A3D"];
    const parts: G[] = [];
    for (let i = 0; i < 6; i++) { const c = cols[(i + Math.floor(v * 6)) % 6]; parts.push(part(box(6, 2.6, 2.5), c, { p: [(i % 2) * 6.3 - 3, 1.3 + Math.floor(i / 2) * 2.65, ((i * 7) % 3) * 0.1] })); }
    return merge(parts);
  },
  billboard: (w, v) => {
    const face = w.profile === "neon" ? ["#FF3DCB", "#36E3FF", "#FFE24A"][Math.floor(v * 3) % 3] : ["#FF5A5F", "#36E3FF", "#FFC233"][Math.floor(v * 3) % 3];
    return merge([
      part(cyl(0.3, 0.4, 9, 6), "#2A2A3A", { p: [0, 4.5, 0] }),
      part(box(12, 6, 0.5), "#1A1A2E", { p: [0, 11, 0] }),
      part(box(11.2, 5.2, 0.12), face, { p: [0, 11, 0.3], glow: 0.9 }),
      part(box(6, 1.2, 0.14), "#FFFFFF", { p: [-1.5, 12, 0.37], glow: 0.9 }), part(ball(1.4, 0), "#FFFFFF", { p: [3.2, 10.6, 0.4], s: [1, 1, 0.1], glow: 0.9 }),
    ]);
  },
  holo: (_w, v) => merge([
    part(cyl(1.6, 2, 0.8, 10), "#1A1C3A", { p: [0, 0.4, 0] }), part(cyl(1.2, 1.2, 0.2, 10), "#36E3FF", { p: [0, 0.85, 0], glow: 1 }),
    part(torus(3, 0.12, 4, 24), "#36E3FF", { p: [0, 5, 0], r: [Math.PI / 2, 0, 0], glow: 1 }),
    part(torus(2.2, 0.1, 4, 20), "#FF3DCB", { p: [0, 7, 0], r: [Math.PI / 2 + 0.3, 0, 0.2], glow: 1 }),
    part(ball(1.1, 1), v > 0.5 ? "#B98CFF" : "#3EE08F", { p: [0, 6, 0], glow: 1 }),
  ]),
  crystal: (w, v) => {
    const cols = ["#B07CFF", "#36E3FF", "#FF5FD2", "#7FF0C8"], c = cols[Math.floor(v * 4) % 4];
    const parts: G[] = [];
    for (let i = 0; i < 4; i++) { const a = i * 1.7 + v * 3; parts.push(part(cone(0.6 - i * 0.08, 3.6 - i * 0.6, 5), i ? shade(c, 0.2) : c, { p: [Math.sin(a) * 0.6 * i, 1.6 - i * 0.2, Math.cos(a) * 0.6 * i], r: [Math.sin(a) * 0.3 * i, 0, Math.cos(a) * 0.3 * i], glow: 1 })); }
    parts.push(part(rock(1, v * 4, 0, 0.5), w.land.mid, { p: [0, 0.1, 0] }));
    return merge(parts);
  },
  mushroom: (_w, v) => {
    const cap = ["#36E3FF", "#FF5FD2", "#B98CFF", "#7FF0C8"][Math.floor(v * 4) % 4];
    return merge([
      part(cyl(0.3, 0.45, 2.6, 7), "#E8E0F0", { p: [0, 1.3, 0] }),
      part(lathe([[0, 0], [1.7, 0.1], [1.6, 0.6], [0.9, 1.1], [0, 1.25]], 10), cap, { p: [0, 2.4, 0], glow: 0.9 }),
      part(cyl(0.15, 0.22, 1.2, 6), "#E8E0F0", { p: [1.2, 0.6, 0.5] }), part(lathe([[0, 0], [0.7, 0.05], [0.6, 0.35], [0, 0.5]], 8), cap, { p: [1.2, 1.15, 0.5], glow: 0.9 }),
    ]);
  },
  stalagmite: (w, v) => merge([
    part(cone(1.4, 5 + v * 4, 6), w.land.high, { p: [0, 2.5 + v * 2, 0] }), part(cone(0.8, 3, 5), w.land.mid, { p: [1.2, 1.5, 0.4] }),
  ]),
  turbine: () => merge([
    part(cyl(0.6, 1, 34, 8), "#F2F4F7", { p: [0, 17, 0] }), part(box(1.6, 1.6, 3.6), "#E8EBF0", { p: [0, 34.6, 0.6] }),
    ...[0, 1, 2].map((i) => part(box(0.9, 14, 0.25), "#FFFFFF", { p: [Math.sin((i * Math.PI * 2) / 3) * 7, 34.6 + Math.cos((i * Math.PI * 2) / 3) * 7, 2.5], r: [0, 0, -(i * Math.PI * 2) / 3] })),
    part(ball(0.35, 0), "#FF3B3B", { p: [0, 35.6, 0.6], glow: 1 }),
  ]),
  wreck: () => merge([
    part(extrude([[-9, 0], [9, 0], [11, 4], [-10, 4]], 5), "#5A4A3A", { p: [0, -0.8, 0], r: [0.25, 0.3, 0.18] }),
    part(cyl(0.3, 0.35, 10, 6), "#4A3A2A", { p: [2, 5, 0], r: [0.3, 0, 0.4] }),
    part(box(4, 3, 4), "#6A5A4A", { p: [-4, 3.4, 0.5], r: [0.25, 0.3, 0.18] }),
  ]),
  seastack: (w, v) => merge([
    part(rock(4.5, v * 13, 1, 2.6), w.land.mid, { p: [0, 7, 0] }), part(rock(3, v * 3, 1, 1.5), w.land.high, { p: [2.5, 2, 1.5] }),
    part(ball(2.2, 0), w.land.low, { p: [0, 13.2, 0], s: [1.3, 0.35, 1.3] }),
  ]),
  tent: (_w, v) => merge([
    part(cone(4, 4.5, 6), v > 0.5 ? "#E8D2A8" : "#C9A57A", { p: [0, 2.25, 0] }),
    part(cone(0.9, 1.4, 6), "#B5483A", { p: [0, 4.9, 0] }),
    part(box(1.6, 2.2, 0.1), "#5A3A2A", { p: [0, 1.1, 3.1], r: [-0.65, 0, 0] }),
    part(box(1.2, 0.5, 1.2), "#7A4A2A", { p: [3.5, 0.25, 2] }), part(ball(0.4, 0), "#FF7A2A", { p: [3.5, 0.7, 2], glow: 0.6 }),
  ]),
  obelisk: (w) => merge([
    part(box(3, 1, 3), w.land.high, { p: [0, 0.5, 0] }), part(cyl(0.8, 1.2, 12, 4), w.land.mid, { p: [0, 7, 0], r: [0, Math.PI / 4, 0] }),
    part(cone(0.85, 1.6, 4), "#FFC233", { p: [0, 13.8, 0], r: [0, Math.PI / 4, 0], glow: w.land.glow ? 0.9 : 0 }),
  ]),
  moored: (_w, v) => {
    const hull = ["#FFFFFF", "#2E6E9A", "#E03A3A", "#F4E3C1"][Math.floor(v * 4) % 4];
    return merge([
      part(extrude([[-3, 0.2], [2.4, 0.2], [3.4, 1.2], [-3.2, 1.2]], 2.2), hull, { p: [0, -0.3, 0], r: [0, Math.PI / 2, 0] }),
      part(box(1.8, 0.1, 4.6), "#B08A5A", { p: [0, 0.92, 0] }),
      part(box(1.4, 1, 1.6), "#FFFFFF", { p: [0, 1.4, -0.4] }), part(box(1.2, 0.4, 0.05), "#9AD8FF", { p: [0, 1.6, 0.42] }),
    ]);
  },
  flagpole: (_w, v) => merge([
    part(cyl(0.08, 0.1, 8, 5), "#E8E8E8", { p: [0, 4, 0] }),
    part(box(2.4, 1.5, 0.06), ["#FF5A5F", "#36E3FF", "#FFC233", "#3EE08F"][Math.floor(v * 4) % 4], { p: [1.25, 7.1, 0] }),
  ]),
  bridgeLights: () => merge([part(box(0.25, 0.25, 0.25), "#36E3FF", { p: [0, 0.2, 0], glow: 1 })]),
};

/** how many colour/shape variants each prop kind has */
export const VARIANTS: Partial<Record<PropKind, number>> = { house: 5, tower: 3, neontower: 4, crystal: 4, mushroom: 3, containers: 2, billboard: 3, moored: 3, flagpole: 3, palm: 2, cactus: 2, blossomtree: 2, jungletree: 2, iceberg: 2, boulder: 2 };
export function propGeometry(k: PropKind, w: World, variant: number, of: number) { return builders[k](w, (variant + 0.5) / of); }

// ------------------------------------------------------------------ horizon landmarks
const far: Record<FarKind, (w: World, v: number) => G> = {
  peaks: (w, v) => merge([
    part(cone(160, 150 + v * 60, 7), w.land.high, { p: [0, 70, 0] }), part(cone(110, 120, 6), w.land.mid, { p: [150, 55, 40] }),
    part(cone(120, 110, 6), shade(w.land.high, -0.1), { p: [-140, 50, -30] }),
  ]),
  snowpeaks: (w, v) => merge([
    part(cone(170, 190 + v * 60, 7), "#7A8494", { p: [0, 90, 0] }), part(cone(80, 80, 7), "#F4F8FF", { p: [0, 160 + v * 30, 0] }),
    part(cone(120, 140, 6), "#6A7484", { p: [160, 65, 50] }), part(cone(55, 55, 6), "#F4F8FF", { p: [160, 118, 50] }),
    part(cone(110, 120, 6), "#8A94A6", { p: [-150, 55, -40] }), part(cone(45, 48, 6), "#F4F8FF", { p: [-150, 100, -40] }),
  ]),
  mesas: (w, v) => merge([
    part(cyl(60, 80, 60 + v * 30, 7), (w.land.strata ?? [w.land.mid])[0], { p: [0, 30, 0] }), part(cyl(61, 60, 6, 7), (w.land.strata ?? [w.land.high])[2] ?? w.land.high, { p: [0, 60 + v * 30, 0] }),
    part(cyl(35, 45, 40, 6), (w.land.strata ?? [w.land.mid])[3] ?? w.land.mid, { p: [110, 20, 30] }),
  ]),
  volcano: (w, v) => merge([
    part(cone(260, 170 + v * 40, 9), "#3A3030", { p: [0, 80, 0] }), part(cyl(40, 60, 18, 9), "#2A2222", { p: [0, 165 + v * 40, 0] }),
    part(cyl(34, 34, 2, 9), w.land.glow ?? "#FF5A1F", { p: [0, 175 + v * 40, 0], glow: 1 }),
    ...[0, 1, 2, 3].map((i) => part(ball(30 + i * 10, 1), "#5A4A48", { p: [i * 12, 200 + v * 40 + i * 28, i * 6], s: [1.2, 0.7, 1.2] })),
  ]),
  skyline: (_w, v) => {
    const parts: G[] = [];
    for (let i = 0; i < 9; i++) { const h = 40 + ((i * 37 + v * 100) % 70); parts.push(part(box(22, h, 22), i % 2 ? "#5A6A8A" : "#4A5878", { p: [(i - 4) * 26, h / 2, ((i * 13) % 5) * 8] })); }
    return merge(parts);
  },
  neonskyline: (_w, v) => {
    const parts: G[] = [];
    for (let i = 0; i < 9; i++) {
      const h = 50 + ((i * 41 + v * 100) % 90), neon = ["#FF3DCB", "#36E3FF", "#B98CFF"][i % 3];
      parts.push(part(box(20, h, 20), "#14163A", { p: [(i - 4) * 25, h / 2, ((i * 13) % 5) * 8] }));
      parts.push(part(box(20.6, 1.2, 20.6), neon, { p: [(i - 4) * 25, h * 0.66, ((i * 13) % 5) * 8], glow: 1 }));
      parts.push(part(box(1, h, 1), neon, { p: [(i - 4) * 25 + 10, h / 2, ((i * 13) % 5) * 8 + 10], glow: 0.8 }));
    }
    return merge(parts);
  },
  jungle: (w) => merge([
    part(ball(140, 1), shade(w.land.high, -0.1), { p: [0, 10, 0], s: [1.4, 0.55, 1] }), part(ball(90, 1), w.land.mid, { p: [150, 0, 40], s: [1.3, 0.6, 1] }),
    part(ball(80, 1), shade(w.land.low, -0.2), { p: [-140, 0, -20], s: [1.4, 0.5, 1] }),
  ]),
  isles: (w, v) => merge([
    part(ball(90, 1), w.land.low, { p: [0, -30, 0], s: [1.4, 0.45, 1] }), part(ball(50, 1), w.land.mid, { p: [20, 0, 10], s: [1, 0.8, 1] }),
    part(cone(60, 70 + v * 30, 7), shade(w.land.high, -0.2), { p: [-40, 30, -10] }), part(ball(60, 1), w.land.shore, { p: [0, -34, 0], s: [1.6, 0.4, 1.2] }),
  ]),
  pagodahill: () => merge([
    part(ball(120, 1), "#6AAE5A", { p: [0, -20, 0], s: [1.3, 0.6, 1] }),
    ...[0, 1, 2, 3].map((i) => part(cyl(16 - i * 3, 20 - i * 3, 5, 4), "#C0392B", { p: [0, 50 + i * 9, 0], r: [0, Math.PI / 4, 0] })),
    ...[0, 1, 2, 3].map((i) => part(box(14 - i * 3, 6, 14 - i * 3), "#E8D8C0", { p: [0, 46 + i * 9, 0] })),
    part(ball(60, 1), "#FF9EC4", { p: [70, 10, 30], s: [1.2, 0.6, 1] }),
  ]),
  dunes: (w, v) => merge([
    part(ball(160, 1), w.land.mid, { p: [0, -60, 0], s: [1.6, 0.5, 1] }), part(ball(110, 1), w.land.low, { p: [160, -40, 60], s: [1.5, 0.5, 1] }),
    part(cone(40, 45 + v * 20, 4), w.land.high, { p: [-60, 22, 20], r: [0, Math.PI / 4, 0] }),
  ]),
  cliffs: (w, v) => merge([
    part(rock(120, v * 30, 1, 0.9), w.land.mid, { p: [0, 30, 0] }), part(rock(90, v * 10, 1, 1.1), w.land.high, { p: [140, 20, 40] }),
  ]),
  cavewall: (w, v) => merge([
    part(rock(140, v * 30, 1, 1.4), w.land.mid, { p: [0, 50, 0] }), part(rock(60, v * 7, 0, 2), w.land.glow ?? "#8C5BFF", { p: [40, 60, 70], glow: 0.7 }),
  ]),
};
export function farGeometry(k: FarKind, w: World, variant: number) { return far[k](w, variant); }
export { mix };
