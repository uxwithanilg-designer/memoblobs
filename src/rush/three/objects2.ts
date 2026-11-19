// The Phase 2–3 things on the track, in 3D: pickups (R-O-L-L-O letters, star shards, chests, glow fruit, time orbs,
// keys, clovers…), power-up orbs, hazards (bombs, laser fences, fire jets and lava pools, crushers, sliding doors,
// rolling logs and barrels, falling rocks, icicles and meteors, saw gears, sea mines, thorn bushes, swinging hammers),
// launchers (cannons, poles, pinball bumpers, geysers, balloons), teleport rings, doors and pipes, hoops, bells, things
// that carry you, ledges and islands, rails, zones painted on the floor, lane dividers, gates with what opens them,
// switches and plates, friend cages, Kranky's Clankers in all their looks, friends, critters and signs — and the
// Kranky machine every boss from world 3 on is built from.
import * as THREE from "three";
import type { Obj } from "../types";
import { elementOf } from "../magicdata";
import type { ObjectArt, View } from "./objects";
import { badge, glow, stripes } from "./tex";

type P = Record<string, THREE.Object3D>;
const BOX = () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const ITEM_ICON: Record<string, string> = { shard: "💎", chest: "🎁", fruit: "🍑", time: "⏱️", mystery: "❓", clover: "🍀", key: "🗝️", scrap: "🗺️", gold: "🌕", egg: "🥚", colour: "🎨" };
const POWER_ICON: Record<string, string> = {
  shield: "🫧", fire: "🔥", water: "💧", thunder: "⚡", shoes: "👟", giant: "⬆️", mini: "⬇️", ghost: "👻", double: "✖️", cape: "🦸", rocket: "🚀", snowball: "❄️",
  star: "⭐", slowmo: "🐢", storm: "🌧️", scale: "🛡️", autohop: "🎯", time: "⏳", buddy: "🐣", board: "🏄", skates: "⛸️", bouncy: "🏀", wings: "🪽", mega: "💥",
};
const ZONE_COL: Record<string, [string, number]> = {
  slow: ["#B08A4A", 0.55], fast: ["#5CF2C9", 0.45], ice: ["#BFE8FF", 0.5], mud: ["#6A4A2A", 0.6], bounce: ["#FF8FC8", 0.45], belt: ["#7A8AA0", 0.6], wind: ["#DDF6FF", 0.18],
  updraft: ["#BFF6FF", 0.3], lowg: ["#B89CFF", 0.25], water: ["#3A9AD8", 0.55], lava: ["#FF6A2A", 0.8], zap: ["#7FD8FF", 0.7], goo: ["#8AD84A", 0.65], web: ["#F2F2F2", 0.4],
  pull: ["#6A3AB8", 0.5], dark: ["#101020", 0.3], light: ["#FFE9A8", 0.25], rain: ["#9AB8D8", 0.2], fog: ["#DDE4EE", 0.2], crumble: ["#8A6A5A", 0.5], headwind: ["#DDF6FF", 0.18],
  hot: ["#FF8A3A", 0.55], underwater: ["#2A7AB8", 0.35], oil: ["#2A2A3A", 0.7], shrink: ["#FFB0E0", 0.4], ride: ["#5CF2C9", 0.3],
};
/** a Clanker's colours by look: body, band, accent */
const BOT_COL: Record<string, [string, string, string]> = {
  E04: ["#E8604F", "#FFD2A0", "#C9D2DE"], E05: ["#5A6AF0", "#2B2B33", "#E0E6EE"], E06: ["#3A3F4E", "#FFB347", "#C9D2DE"], E07: ["#5CB85C", "#FFFFFF", "#E8504F"], E08: ["#E8504F", "#3A6AF0", "#C9D2DE"],
  E09: ["#7A8AA0", "#FFD15A", "#3A6AF0"], E10: ["#A8743A", "#FFD15A", "#C9D2DE"], E11: ["#BFE8FF", "#3A6AF0", "#FFFFFF"], E12: ["#FF6A2A", "#FFD15A", "#2B2B33"], E13: ["#FFFFFF", "#FFB347", "#3A3F4E"],
  E14: ["#5CF2C9", "#2B2B33", "#FFD15A"], E15: ["#FF8FC8", "#FFFFFF", "#FF5A7A"], E16: ["#C9D2DE", "#B89CFF", "#FFFFFF"], E17: ["#DDE4FF", "#7A8AC0", "#FFE08A"], E18: ["#E8504F", "#FFFFFF", "#2B2B33"],
  E19: ["#3A9AD8", "#FFD15A", "#FFFFFF"], E20: ["#3A2A4A", "#B89CFF", "#FFD15A"], E21: ["#A8743A", "#5CF2C9", "#E8504F"], E22: ["#FFD15A", "#2B2B33", "#E8504F"], E23: ["#2B2B33", "#FF3A3A", "#C9D2DE"],
  E24: ["#3A6AF0", "#FFD15A", "#C9D2DE"], E25: ["#FFB0E0", "#7A5CFF", "#FFFFFF"], E26: ["#FFD15A", "#2B2B33", "#E8504F"], E27: ["#5A6A3A", "#FFD15A", "#2B2B33"], E28: ["#FF5A7A", "#FFFFFF", "#2B2B33"],
  E29: ["#7A5CFF", "#5CF2C9", "#FFFFFF"], E30: ["#C9D2DE", "#E8504F", "#2B2B33"], thief: ["#2B2B33", "#FFD15A", "#FFFFFF"], car: ["#FF5A7A", "#FFFFFF", "#3A3F4E"],
};
const FRIEND_COL: Record<string, string> = { momo: "#FF9DB2", kiko: "#FFB347", pip: "#7FD8FF", bonbon: "#B89CFF", gloop: "#8AD84A", zib: "#FFE066", relay: "#FF9DB2", cheer: "#FFE066", herd: "#C99A6A", crowd: "#FF9DB2", firefly: "#FFF2A0", fast: "#5CF2C9", tiki: "#E8A23A" };

/** build a Phase 2–3 kind into root; false if this kind has no art (it stays invisible) */
export function buildMore(a: ObjectArt, o: Obj, root: THREE.Group, parts: P): boolean {
  const W = (o.w ?? 0.6) * 2, D = (o.ds ?? 0.5) * 2, T = o.tall ?? 1;
  let look = o.look ?? "";
  if (look.startsWith("mg:") && o.k !== "zone") { root.userData.custom = true; return magicArt(a, o, root, parts); }
  if (look.startsWith("sig:")) { const sg = look.slice(4); if (sigArt(a, o, sg, root, parts)) { root.userData.custom = true; return true; } look = SIG_LOOK[sg] ?? ""; }
  switch (o.k) {
    // ---------------------------------------------------------------- pickups and powers
    case "item": {
      if (o.item === "coin") {
        const c = a.add(root, a.g("coin", () => new THREE.CylinderGeometry(0.34, 0.34, 0.07, 26).rotateX(Math.PI / 2)), a.std("#FFC94A", { metalness: 0.85, roughness: 0.2, emissive: "#B8860B", emissiveIntensity: 0.5 }), 0, 0.5, 0);
        a.add(c, a.g("coinRim", () => new THREE.TorusGeometry(0.34, 0.035, 8, 26)), a.std("#FFE08A", { metalness: 0.9, roughness: 0.15 }));
        const star = new THREE.Sprite(a.m("coinStar", () => new THREE.SpriteMaterial({ map: badge("⭐", "rgba(0,0,0,0)"), transparent: true })) as THREE.SpriteMaterial); star.scale.setScalar(0.42); c.add(star);
        parts.spin = c; root.add(a.glowAt("#FFD15A", 1.8, 0.7, 0, 0.5, 0));
        break;
      }
      if (o.item === "life") {
        const h = new THREE.Group(); h.position.y = 0.55; root.add(h); parts.spin = h;
        const red = a.std("#FF3A5A", { emissive: "#FF1A4A", emissiveIntensity: 0.7, roughness: 0.25 });
        for (const sx of [-1, 1]) a.add(h, a.g("heartLobe", () => new THREE.SphereGeometry(0.22, 16, 12)), red, sx * 0.16, 0.08, 0);
        const tip = a.add(h, a.g("heartTip", () => new THREE.ConeGeometry(0.3, 0.42, 16).rotateZ(Math.PI)), red, 0, -0.16, 0); tip.scale.z = 0.7;
        root.add(a.glowAt("#FF5A7A", 2.4, 0.9, 0, 0.55, 0));
        break;
      }
      if (o.item === "letter") {
        const L = "ROLLO"[(o.p ?? 0) % 5];
        const s = new THREE.Sprite(a.m(`letter${L}`, () => new THREE.SpriteMaterial({ map: badge(L, "#FF5A7A"), transparent: true })) as THREE.SpriteMaterial);
        s.scale.setScalar(1.3); s.position.y = 0.4; root.add(s); parts.spin = s;
        root.add(a.glowAt("#FF9DB2", 2.6, 0.7, 0, 0.4, 0));
        break;
      }
      if (o.item === "shard") { const m = a.add(root, a.g("shard", () => new THREE.OctahedronGeometry(0.42, 0)), a.std("#C9A8FF", { emissive: "#8A5AFF", emissiveIntensity: 0.9, metalness: 0.3, roughness: 0.15 }), 0, 0.5, 0); m.scale.y = 1.5; parts.spin = m; root.add(a.glowAt("#C9A8FF", 2.4, 0.7, 0, 0.5, 0)); break; }
      if (o.item === "chest") { const c = a.add(root, a.g("chest", BOX), a.std("#A8743A", { roughness: 0.6 })); c.scale.set(1.1, 0.7, 0.8); const lid = a.add(root, a.g("chestLid", () => new THREE.CylinderGeometry(0.4, 0.4, 1.1, 14, 1, false, 0, Math.PI).rotateZ(Math.PI / 2)), a.std("#C98A4A"), 0, 0.7, 0); lid.scale.z = 1; a.add(root, a.g("chestBand", BOX), a.std("#FFD15A", { metalness: 0.7, roughness: 0.3 }), 0, 0, -0.41).scale.set(0.16, 0.9, 0.02); root.add(a.glowAt("#FFD15A", 2.4, 0.5, 0, 0.6, 0)); break; }
      if (o.item === "gold") { const m = a.add(root, a.g("goldP", () => new THREE.IcosahedronGeometry(0.5, 2)), a.std("#FFD15A", { emissive: "#FFB840", emissiveIntensity: 1, metalness: 0.8, roughness: 0.1 }), 0, 0.5, 0); parts.spin = m; root.add(a.glowAt("#FFE08A", 4, 0.9, 0, 0.5, 0)); break; }
      const icon = ITEM_ICON[o.item ?? "mystery"] ?? "❓";
      const bubble = a.add(root, a.g("itemBubble", () => new THREE.SphereGeometry(0.5, 18, 14)), a.m("itemBubbleM", () => new THREE.MeshPhysicalMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.25, roughness: 0.05, transmission: 0.6, clearcoat: 1 })), 0, 0.5, 0);
      void bubble;
      const s = new THREE.Sprite(a.m(`itemIcon${icon}`, () => new THREE.SpriteMaterial({ map: badge(icon, "rgba(255,255,255,0)"), transparent: true })) as THREE.SpriteMaterial);
      s.scale.setScalar(0.85); s.position.y = 0.5; root.add(s); parts.spin = s;
      root.add(a.glowAt(o.item === "fruit" ? "#FFB347" : o.item === "time" ? "#7FD8FF" : "#FFE08A", 2.2, 0.6, 0, 0.5, 0));
      break;
    }
    case "power": {
      const icon = POWER_ICON[o.power ?? "shield"] ?? "⭐";
      const orb = a.add(root, a.g("powerOrb", () => new THREE.IcosahedronGeometry(0.55, 2)), a.m("powerOrbM", () => new THREE.MeshPhysicalMaterial({ color: "#B8F6FF", emissive: "#3AC8FF", emissiveIntensity: 0.5, transparent: true, opacity: 0.5, roughness: 0.05, clearcoat: 1 })), 0, 0.6, 0);
      parts.orb = orb;
      const s = new THREE.Sprite(a.m(`powerIcon${icon}`, () => new THREE.SpriteMaterial({ map: badge(icon, "rgba(255,255,255,0)"), transparent: true })) as THREE.SpriteMaterial);
      s.scale.setScalar(0.8); s.position.y = 0.6; root.add(s); parts.spin = s;
      root.add(a.glowAt("#7FE8FF", 3, 0.7, 0, 0.6, 0));
      break;
    }
    // ---------------------------------------------------------------- hazards
    case "bomb": {
      const b = new THREE.Group(); b.position.y = 0.42; root.add(b); parts.body = b;
      a.add(b, a.g("bombBall", () => new THREE.SphereGeometry(0.42, 18, 14)), a.phys(look === "lava" ? "#3A1A10" : "#22222A"));
      a.add(b, a.g("bombCap", () => new THREE.CylinderGeometry(0.12, 0.14, 0.14, 10)), a.std("#7C8899"), 0, 0.44, 0);
      const spark = a.glowSprite(look === "lava" ? "#FF6A2A" : "#FFB347", 0.9, 1); spark.position.y = 0.62; b.add(spark); parts.spark = spark;
      if (look === "lava") b.add(a.glowAt("#FF6A2A", 2.4, 0.6, 0, 0, 0));
      if (o.drop) addShadow(a, root, 0.9, parts);
      break;
    }
    case "laser": {
      for (const sx of [-1, 1]) a.add(root, a.g("laserPost", () => new THREE.CylinderGeometry(0.08, 0.1, 1, 8).translate(0, 0.5, 0)), a.std("#3A3F4E", { metalness: 0.6 }), sx * W / 2, 0, 0).scale.y = T;
      const beam = a.add(root, a.g("laserBeam", BOX), a.m(`laserM${look}`, () => new THREE.MeshBasicMaterial({ color: look === "tile" ? "#FF5AD8" : look === "eye" ? "#FF3A3A" : "#FF4A6A", transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })));
      beam.scale.set(W, T * 0.92, 0.08); parts.beam = beam;
      const g = a.glowSprite("#FF4A6A", Math.max(W, T) * 1.4, 0.4); g.position.y = T / 2; root.add(g); parts.glow = g;
      break;
    }
    case "fire": {
      if (look === "lava") {
        const pool = new THREE.Mesh(a.g("lavaPool", () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), a.m("lavaM", () => new THREE.MeshBasicMaterial({ map: stripes("#FF8A2A", "#FF3A1A"), color: "#FFB060" })));
        pool.scale.set(W, 1, D); pool.position.y = 0.04; root.add(pool); parts.pool = pool;
        root.add(a.glowAt("#FF6A2A", Math.max(W, D) * 1.3, 0.55, 0, 0.3, 0));
      } else {
        a.add(root, a.g("jetBase", () => new THREE.CylinderGeometry(0.3, 0.38, 0.3, 12)), a.std("#3A3F4E", { metalness: 0.6 }), 0, 0.15, 0);
        const flame = a.glowSprite("#FF8A2A", 1.6, 1); flame.position.y = 1.0; flame.scale.set(1.2, 2.4, 1); root.add(flame); parts.flame = flame;
        const core = a.glowSprite("#FFE08A", 0.9, 1); core.position.y = 0.8; core.scale.set(0.6, 1.4, 1); root.add(core); parts.core = core;
      }
      break;
    }
    case "crusher": {
      const block = new THREE.Group(); root.add(block); parts.block = block;
      a.add(block, a.g("crusher", BOX), a.phys(look === "piston" ? "#7C8899" : "#5A5F6E")).scale.set(W, 1.2, D);
      a.add(block, a.g("crusherFace", BOX), a.m("crushStripe", () => new THREE.MeshStandardMaterial({ map: stripes("#FFE066", "#2B2B33"), roughness: 0.5 })), 0, -0.05, 0).scale.set(W + 0.02, 0.14, D + 0.02);
      for (const sx of [-1, 1]) a.add(root, a.g("crushRail", () => new THREE.CylinderGeometry(0.08, 0.08, 4, 8).translate(0, 2, 0)), a.std("#3A3F4E"), sx * (W / 2 + 0.15), 0, 0);
      break;
    }
    case "door": {
      const dl = new THREE.Group(), dr = new THREE.Group(); root.add(dl, dr); parts.dl = dl; parts.dr = dr;
      for (const [g, sx] of [[dl, -1], [dr, 1]] as [THREE.Group, number][]) a.add(g, a.g("doorPanel", BOX), a.m(`doorM${look}`, () => new THREE.MeshStandardMaterial({ map: stripes(look === "beat" ? "#B89CFF" : "#FFE066", "#3A3F4E"), roughness: 0.5, metalness: 0.4 })), sx * W / 4, 0, 0).scale.set(W / 2, Math.max(1.6, T), 0.3);
      break;
    }
    case "roller": {
      const r = Math.max(0.3, T * 0.5);
      const g = new THREE.Group(); g.position.y = r; root.add(g); parts.roll = g;
      if (look === "barrel" || look === "ball") {
        const n = look === "ball" ? 1 : Math.max(1, Math.round(W / 1.4));
        for (let i = 0; i < n; i++) a.add(g, a.g(look === "ball" ? "rBall" : "barrel", () => look === "ball" ? new THREE.SphereGeometry(1, 16, 12) : new THREE.CylinderGeometry(1, 1, 1.2, 14).rotateZ(Math.PI / 2)), a.std(look === "ball" ? "#2B2B33" : "#A8743A", { roughness: 0.6 }), -W / 2 + (i + 0.5) * (W / n), 0, 0).scale.setScalar(look === "ball" ? r : r);
      } else {
        const log = a.add(g, a.g("logR", () => new THREE.CylinderGeometry(1, 1, 1, 16).rotateZ(Math.PI / 2)), a.std(look === "flick" || look === "guard" ? "#7C8899" : "#8E5F38", { roughness: 0.85 }));
        log.scale.set(W, r, r);
        for (const sx of [-1, 1]) a.add(g, a.g("logEnd", () => new THREE.CircleGeometry(1, 16).rotateY(Math.PI / 2)), a.std("#E8C08A"), sx * W / 2 + sx * 0.01, 0, 0).scale.set(1, r * 0.9, r * 0.9);
      }
      break;
    }
    case "faller": {
      const g = new THREE.Group(); root.add(g); parts.body = g;
      const col = look === "icicle" ? "#DDF4FF" : look === "meteor" || look === "star" ? "#FF8A3A" : look === "bolt" ? "#FFF2A0" : look === "debris" ? "#7C8899" : "#7A6A5A";
      const geo = look === "icicle" ? a.g("icicle", () => new THREE.ConeGeometry(0.4, 1.4, 8).rotateX(Math.PI)) : look === "bolt" ? a.g("boltGeo", () => new THREE.OctahedronGeometry(0.5, 0)) : a.g("rock", () => new THREE.DodecahedronGeometry(0.6, 0));
      const m = a.add(g, geo, look === "meteor" || look === "star" || look === "bolt" ? a.std(col, { emissive: col, emissiveIntensity: 0.9 }) : a.std(col, { roughness: 0.9 }), 0, 0.6, 0);
      if (look === "icicle") m.position.y = 0.7;
      if (look === "meteor" || look === "star" || look === "bolt") g.add(a.glowAt(col, 2.6, 0.8, 0, 0.6, 0));
      addShadow(a, root, 1.1, parts);
      break;
    }
    case "saw": {
      const g = new THREE.Group(); g.position.y = 0.75; root.add(g); parts.spin = g;
      a.add(g, a.g("sawDisc", () => new THREE.CylinderGeometry(0.7, 0.7, 0.14, 24).rotateZ(Math.PI / 2)), a.phys("#C9D2DE"));
      for (let i = 0; i < 12; i++) { const t2 = a.add(g, a.g("sawTooth", () => new THREE.ConeGeometry(0.1, 0.24, 4)), a.phys("#E0E6EE")); const ang = (i / 12) * Math.PI * 2; t2.position.set(0, Math.cos(ang) * 0.78, Math.sin(ang) * 0.78); t2.rotation.x = ang; }
      a.add(g, a.g("sawHub", () => new THREE.CylinderGeometry(0.2, 0.2, 0.2, 12).rotateZ(Math.PI / 2)), a.std("#FFD15A", { metalness: 0.7 }));
      break;
    }
    case "mine": {
      const g = new THREE.Group(); g.position.y = 0.45; root.add(g); parts.body = g;
      a.add(g, a.g("mine", () => new THREE.SphereGeometry(0.4, 16, 12)), look === "bubble" ? a.m("bubbleMine", () => new THREE.MeshPhysicalMaterial({ color: "#9FE8FF", transparent: true, opacity: 0.55, roughness: 0.05, clearcoat: 1 })) : a.phys("#3A3F4E"));
      for (let i = 0; i < 8; i++) { const sp = a.add(g, a.g("mineSpike", () => new THREE.ConeGeometry(0.07, 0.24, 6)), a.phys("#E8504F")); const th = (i / 8) * Math.PI * 2, ph = i % 2 ? 0.7 : -0.7; sp.position.set(Math.cos(th) * 0.42 * Math.cos(ph), Math.sin(ph) * 0.42, Math.sin(th) * 0.42 * Math.cos(ph)); sp.lookAt(sp.position.clone().multiplyScalar(2)); sp.rotateX(Math.PI / 2); }
      g.add(a.glowAt("#FF4A6A", 1.4, 0.5, 0, 0, 0));
      break;
    }
    case "thorn": {
      for (let u = -W / 2 + 0.5; u < W / 2; u += 0.9) {
        a.add(root, a.g("bush", () => new THREE.IcosahedronGeometry(0.55, 1)), a.std("#3E7A3A", { roughness: 0.9 }), u, 0.45, 0).scale.set(1, 0.9, 1.1);
        for (let i = 0; i < 5; i++) { const th = a.add(root, a.g("thornSpike", () => new THREE.ConeGeometry(0.06, 0.32, 5)), a.std("#E8D8A0"), u + Math.cos(i * 1.3) * 0.45, 0.45 + Math.sin(i * 2.1) * 0.3, Math.sin(i * 1.3) * 0.45); th.rotation.set(i, i * 2, 0); }
      }
      break;
    }
    case "swing": {
      const head = new THREE.Group(); root.add(head); parts.head = head;
      if (look === "log") a.add(head, a.g("swingLog", () => new THREE.CylinderGeometry(0.45, 0.45, 2.2, 14)), a.std("#8E5F38", { roughness: 0.85 }), 0, 0.9, 0).rotation.x = Math.PI / 2;
      else { a.add(head, a.g("hammer", () => new THREE.CylinderGeometry(0.6, 0.6, 1.4, 16).rotateZ(Math.PI / 2)), a.std("#FF8FC8", { roughness: 0.6 }), 0, 0.9, 0); a.add(head, a.g("hammerBand", () => new THREE.CylinderGeometry(0.62, 0.62, 0.3, 16).rotateZ(Math.PI / 2)), a.std("#FFFFFF"), 0, 0.9, 0); }
      const rope = a.add(head, a.g("rope", () => new THREE.CylinderGeometry(0.04, 0.04, 1, 6).translate(0, 0.5, 0)), a.std("#C9B08A"), 0, 1.4, 0); rope.scale.y = 5;
      break;
    }
    // ---------------------------------------------------------------- launchers and helpers
    case "cannon": {
      a.add(root, a.g("cannonBase", () => new THREE.CylinderGeometry(0.8, 0.9, 0.4, 16)), a.std("#3A3F4E", { metalness: 0.5 }), 0, 0.2, 0);
      const barrel = a.add(root, a.g("cannonBarrel", () => new THREE.CylinderGeometry(0.55, 0.65, 1.6, 18, 1, true)), look === "band" ? a.std("#FF8FC8") : look === "sling" ? a.std("#A8743A") : look === "barrel" ? a.std("#C98A4A") : a.phys("#5A6AF0"), 0, 1.0, 0.3);
      barrel.rotation.x = 0.55; parts.barrel = barrel;
      root.add(a.glowAt("#FFB347", 2.4, 0.5, 0, 1.2, 0));
      break;
    }
    case "pole": {
      a.add(root, a.g("pole", () => new THREE.CylinderGeometry(0.12, 0.12, 3.4, 10).translate(0, 1.7, 0)), a.phys(look === "kiko" ? "#8E5F38" : "#FFD15A"));
      const ring = a.add(root, a.g("poleRing", () => new THREE.TorusGeometry(0.4, 0.07, 8, 18).rotateX(Math.PI / 2)), a.std("#FF5A7A", { emissive: "#FF5A7A", emissiveIntensity: 0.5 }), 0, 2.4, 0); parts.ring = ring;
      break;
    }
    case "bumper": {
      a.add(root, a.g("bumperBody", () => new THREE.CylinderGeometry(0.6, 0.7, 1, 20).translate(0, 0.5, 0)), a.std("#FFFFFF", { roughness: 0.3 }));
      const rim = a.add(root, a.g("bumperRim", () => new THREE.TorusGeometry(0.66, 0.12, 10, 24).rotateX(Math.PI / 2)), a.std("#FF3A6A", { emissive: "#FF3A6A", emissiveIntensity: 0.7 }), 0, 0.55, 0); parts.rim = rim;
      a.add(root, a.g("bumperTop", () => new THREE.CylinderGeometry(0.5, 0.5, 0.1, 20)), a.std("#FFE066", { emissive: "#FFB347", emissiveIntensity: 0.8 }), 0, 1.02, 0);
      break;
    }
    case "geyser": {
      a.add(root, a.g("geyserRim", () => new THREE.TorusGeometry(0.7, 0.18, 8, 20).rotateX(Math.PI / 2)), a.std("#7A6A5A", { roughness: 0.9 }), 0, 0.1, 0);
      const jet = a.add(root, a.g("geyserJet", () => new THREE.CylinderGeometry(0.4, 0.6, 1, 14, 1, true).translate(0, 0.5, 0)), a.m("geyserM", () => new THREE.MeshBasicMaterial({ color: look === "blast" ? "#FFB0A0" : "#BFE8FF", transparent: true, opacity: 0.55, depthWrite: false })));
      jet.scale.y = 3; parts.jet = jet;
      const spray = a.glowSprite("#E8F8FF", 2.4, 0.8); spray.position.y = 3; root.add(spray); parts.spray = spray;
      break;
    }
    case "balloon": {
      const b = new THREE.Group(); root.add(b); parts.body = b;
      a.add(b, a.g("balloon", () => new THREE.SphereGeometry(0.5, 18, 14)), a.std(o.target ? "#FF5A7A" : "#5CF2C9", { roughness: 0.25 }), 0, 0.5, 0).scale.y = 1.2;
      a.add(b, a.g("balloonString", () => new THREE.CylinderGeometry(0.01, 0.01, 1, 4).translate(0, -0.5, 0)), a.std("#FFFFFF"), 0, -0.1, 0);
      if (o.target) b.add(a.glowAt("#FF9DB2", 2.4, 0.8, 0, 0.5, 0));
      break;
    }
    case "tele": {
      if (look === "pipe") { const p2 = a.add(root, a.g("pipe", () => new THREE.CylinderGeometry(0.9, 0.9, 1.4, 20, 1, true)), a.std("#3AB85A", { side: THREE.DoubleSide }), 0, 0.7, 0); void p2; a.add(root, a.g("pipeRim", () => new THREE.TorusGeometry(0.95, 0.16, 8, 22).rotateX(Math.PI / 2)), a.std("#5CD87A"), 0, 1.4, 0); }
      else if (look === "door") { for (const sx of [-1, 1]) a.add(root, a.g("doorPost", () => new THREE.BoxGeometry(0.25, 2.6, 0.25).translate(0, 1.3, 0)), a.std("#B89CFF"), sx * 0.9, 0, 0); a.add(root, a.g("doorTop", () => new THREE.BoxGeometry(2.05, 0.25, 0.25)), a.std("#B89CFF"), 0, 2.6, 0); }
      else a.add(root, a.g("teleRing", () => new THREE.TorusGeometry(1.1, 0.14, 10, 32)), a.std("#7FD8FF", { emissive: "#3AC8FF", emissiveIntensity: 0.9 }), 0, 1.2, 0);
      const swirl = new THREE.Mesh(a.g("teleDisc", () => new THREE.CircleGeometry(1, 28)), a.m("teleSwirl", () => new THREE.MeshBasicMaterial({ map: glow("#9F7AFF"), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
      swirl.position.y = look === "pipe" ? 1.42 : 1.2; if (look === "pipe") swirl.rotation.x = -Math.PI / 2; root.add(swirl); parts.swirl = swirl;
      break;
    }
    case "hoop": {
      const ring = a.add(root, a.g("hoop", () => new THREE.TorusGeometry(1.15, 0.11, 10, 32)), look === "coral" ? a.std("#FF8FA0", { roughness: 0.6 }) : a.std("#FFE066", { emissive: "#FFB347", emissiveIntensity: 0.8 }), 0, 0, 0);
      parts.ring = ring; root.add(a.glowAt("#FFE08A", 3, 0.4, 0, 0, 0));
      break;
    }
    case "bell": {
      const b = new THREE.Group(); b.position.y = 0.5; root.add(b); parts.body = b;
      a.add(b, a.g("bell", () => new THREE.LatheGeometry([new THREE.Vector2(0.02, 0.5), new THREE.Vector2(0.22, 0.45), new THREE.Vector2(0.3, 0.2), new THREE.Vector2(0.38, -0.1), new THREE.Vector2(0.45, -0.2)], 18)), a.phys("#FFD15A"));
      a.add(b, a.g("clapper", () => new THREE.SphereGeometry(0.09, 10, 8)), a.std("#8E5F38"), 0, -0.22, 0);
      b.add(a.glowAt("#FFE08A", 1.8, 0.6, 0, 0, 0));
      break;
    }
    case "carry": {
      const g = new THREE.Group(); root.add(g); parts.body = g;
      if (look === "balloons" || look === "bubble" || look === "pip") {
        if (look === "bubble" || look === "pip") a.add(g, a.g("carryBubble", () => new THREE.SphereGeometry(1.3, 20, 16)), a.m("carryBubbleM", () => new THREE.MeshPhysicalMaterial({ color: "#BFF2FF", transparent: true, opacity: 0.3, roughness: 0.02, clearcoat: 1 })), 0, 1.2, 0);
        else for (let i = 0; i < 5; i++) a.add(g, a.g("balloon", () => new THREE.SphereGeometry(0.5, 18, 14)), a.std(["#FF5A7A", "#5CF2C9", "#FFE066", "#B89CFF", "#7FD8FF"][i]), Math.cos(i * 1.3) * 0.6, 2.8 + (i % 2) * 0.4, Math.sin(i * 1.3) * 0.6);
      } else if (look === "hook") {
        a.add(g, a.g("hookBar", () => new THREE.CylinderGeometry(0.05, 0.05, 4, 6).translate(0, 2, 0)), a.std("#3A3F4E"), 0, 1.6, 0);
        a.add(g, a.g("hook", () => new THREE.TorusGeometry(0.35, 0.08, 8, 16, Math.PI * 1.4)), a.phys("#FFD15A"), 0, 1.5, 0);
      } else if (look === "lift") {
        a.add(g, a.g("liftDeck", BOX), a.phys("#7C8899")).scale.set(2.4, 0.2, 2.4);
        for (const sx of [-1, 1]) a.add(g, a.g("liftPost", () => new THREE.CylinderGeometry(0.08, 0.08, 6, 8).translate(0, 3, 0)), a.std("#FFD15A"), sx * 1.2, 0, 0);
      } else {
        // a friend or a creature that carries you: a big soft body with eyes and wings / fins
        const col = { leaf: "#7AC85A", kite: "#FF5A7A", glider: "#FFE066", owl: "#A8743A", bonbon: "#B89CFF", turtle: "#5CB85C", whale: "#3A6AF0", rocket: "#E8504F", serpent: "#BFE8FF" }[look] ?? "#FF9DB2";
        const body = a.add(g, a.g("carrier", () => new THREE.SphereGeometry(1, 20, 14)), a.std(col, { roughness: 0.45 }), 0, 0.7, 0);
        body.scale.set(look === "leaf" || look === "kite" || look === "glider" ? 2.2 : 1.3, look === "leaf" || look === "kite" || look === "glider" ? 0.12 : 0.8, look === "whale" || look === "serpent" ? 3 : 1.6);
        if (!(look === "leaf" || look === "kite" || look === "glider")) a.eyes(g, 0.95, -1.15, 0.35);
      }
      g.add(a.glowAt("#BFF2FF", 3, 0.3, 0, 1, 0));
      break;
    }
    // ---------------------------------------------------------------- ground, gates and switches
    case "ramp": {
      const r = a.add(root, a.g("wedge", () => { const sh = new THREE.Shape(); sh.moveTo(-0.5, 0); sh.lineTo(0.5, 0); sh.lineTo(0.5, 1); sh.closePath(); const e = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }); e.translate(0, 0, -0.5); e.rotateY(-Math.PI / 2); return e; }), a.std("#C98A4A", { roughness: 0.7 }));
      r.scale.set(W, o.h, D); root.userData.flat = true;
      break;
    }
    case "rail": case "zone": case "divider": {
      buildLong(a, o, root);
      break;
    }
    case "gate": {
      const need = o.need?.k ?? look;
      const col = need === "switch" ? "#3A6AF0" : need === "key" ? "#FFD15A" : need === "bells" ? "#FFB347" : need === "colour" ? ["#FF5A7A", "#5CF2C9", "#B89CFF"][o.need?.v ?? 0] : need === "lanterns" ? "#FF8A3A" : need === "speedMin" ? "#5CF2C9" : need === "speedMax" ? "#FF3A3A" : "#B89CFF";
      for (const sx of [-1, 1]) a.add(root, a.g("gatePost", () => new THREE.BoxGeometry(0.4, 1, 0.4).translate(0, 0.5, 0)), a.std("#3A3F4E", { metalness: 0.5 }), sx * (W / 2 + 0.2), 0, 0).scale.y = T + 0.4;
      const panel = a.add(root, a.g("gatePanel", BOX), a.m(`gatePanel${col}`, () => new THREE.MeshStandardMaterial({ map: stripes(col, "#2B2B33"), roughness: 0.4, emissive: col, emissiveIntensity: 0.25, transparent: true, opacity: 0.92 })));
      panel.scale.set(W, T, 0.25); parts.panel = panel;
      const icon = { switch: "🔵", key: "🗝️", bells: "🔔", colour: "🎨", lanterns: "🏮", speedMin: "⏩", speedMax: "🐢", timed: "⏱️", path: "🔵", light: "💡", zib: "⚡", tile: "🔵", pound: "⬇️", draw: "🔔", tower: "🔔", radar: "🐢", speed: "⏩" }[need] ?? "🔒";
      const s = new THREE.Sprite(a.m(`gateIcon${icon}`, () => new THREE.SpriteMaterial({ map: badge(icon, "#2B2B33"), transparent: true })) as THREE.SpriteMaterial);
      s.position.y = T + 0.9; s.scale.setScalar(1.3); root.add(s);
      break;
    }
    case "switch": case "plate": {
      const col = o.item === "colour" ? ["#FF5A7A", "#5CF2C9", "#B89CFF"][o.p ?? 0] : o.k === "plate" ? "#FF8A3A" : "#3A6AF0";
      a.add(root, a.g("switchBase", () => new THREE.CylinderGeometry(1, 1.1, 0.12, 24)), a.std("#3A3F4E", { metalness: 0.5 }), 0, 0.06, 0).scale.set(W / 2 + 0.1, 1, D / 2 + 0.1);
      const btn = a.add(root, a.g("switchBtn", () => new THREE.CylinderGeometry(1, 1, 0.14, 24)), a.std(col, { emissive: col, emissiveIntensity: 0.8 }), 0, 0.16, 0); btn.scale.set(W / 2 * 0.7, 1, D / 2 * 0.7); parts.btn = btn;
      if (o.k === "plate") { const s = new THREE.Sprite(a.m("plateIcon", () => new THREE.SpriteMaterial({ map: badge("⬇️", "#FF8A3A"), transparent: true })) as THREE.SpriteMaterial); s.position.y = 1.4; s.scale.setScalar(0.9); root.add(s); parts.spin = s; }
      root.add(a.glowAt(col, 2.4, 0.5, 0, 0.2, 0));
      break;
    }
    case "cage": {
      for (let i = 0; i < 8; i++) { const th = (i / 8) * Math.PI * 2; a.add(root, a.g("cageBar", () => new THREE.CylinderGeometry(0.04, 0.04, 1.3, 6).translate(0, 0.65, 0)), a.phys("#C9D2DE"), Math.cos(th) * 0.55, 0, Math.sin(th) * 0.55); }
      a.add(root, a.g("cageTop", () => new THREE.CylinderGeometry(0.62, 0.62, 0.1, 18)), a.phys("#7C8899"), 0, 1.32, 0);
      friendBlob(a, root, "#FF9DB2", 0.32, 0.45, parts);
      break;
    }
    // ---------------------------------------------------------------- Clankers, friends, critters, markers
    case "clanker": { clankerArt(a, o, root, parts); break; }
    case "friend": {
      if (look === "firefly") { const f = a.glowSprite("#FFF2A0", 1.6, 1); f.position.y = 2; root.add(f); parts.spin = f; break; }
      const n = look === "crowd" || look === "cheer" ? 5 : 1;
      for (let i = 0; i < n; i++) friendBlob(a, root, FRIEND_COL[look] ?? "#FF9DB2", n > 1 ? 0.35 : 0.42, 0.45, parts, n > 1 ? (i - 2) * 0.9 : 0, n > 1 ? 1.2 : 0, i);
      break;
    }
    case "critter": {
      const g = new THREE.Group(); root.add(g); parts.body = g;
      a.add(g, a.g("fishBody", () => new THREE.SphereGeometry(0.4, 16, 12)), a.std("#FF8A3A", { roughness: 0.35 }), 0, 0.6, 0).scale.set(0.7, 0.9, 1.4);
      a.add(g, a.g("fishTail", () => new THREE.ConeGeometry(0.3, 0.5, 4).rotateX(Math.PI / 2)), a.std("#FFB347"), 0, 0.6, 0.7);
      a.eyes(g, 0.72, -0.45, 0.14);
      break;
    }
    case "sign": { a.add(root, a.g("signPost", () => new THREE.CylinderGeometry(0.06, 0.07, 2, 8).translate(0, 1, 0)), a.std("#8E5F38")); const s = new THREE.Sprite(a.m("signArrow", () => new THREE.SpriteMaterial({ map: badge("➡️", "#FFE066"), transparent: true })) as THREE.SpriteMaterial); s.position.y = 2.1; s.scale.setScalar(1); root.add(s); break; }
    case "lantern": {
      a.add(root, a.g("lanternPost", () => new THREE.CylinderGeometry(0.05, 0.06, 2.2, 8).translate(0, 1.1, 0)), a.std("#3A3F4E"));
      const l = a.add(root, a.g("paperLantern", () => new THREE.SphereGeometry(0.32, 14, 10)), a.std("#FF8A3A", { emissive: "#FF5A2A", emissiveIntensity: 0.5 }), 0, 2.2, 0); l.scale.y = 1.25; parts.lamp = l;
      root.add(a.glowAt("#FFB347", 2.2, 0.6, 0, 2.2, 0));
      break;
    }
    case "cam": return true;
    default: return false;
  }
  return true;
}

// ---------------------------------------------------------------- Mayamma's magics
const MAGIC_MAT = new Map<string, THREE.Material>();
/** her spell in its element's colours: orbs, curtains, rings, pillars, waves, bolts, spikes, ghosts */
function magicArt(a: ObjectArt, o: Obj, root: THREE.Group, parts: P): boolean {
  const [, eid, form] = (o.look ?? "").split(":");
  const el = elementOf(eid);
  const W = (o.w ?? 0.6) * 2, T = o.tall ?? 1;
  const glowM = (c: string, op = 0.9) => a.m(`mgG:${c}:${op}`, () => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.3, transparent: op < 1, opacity: op, roughness: 0.3, depthWrite: op >= 1 }));
  const veil = () => a.m(`mgV:${el.id}`, () => new THREE.MeshBasicMaterial({ map: shimmer(el.col, el.col2), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  void MAGIC_MAT;
  const body = new THREE.Group(); root.add(body); parts.body = body;
  switch (form) {
    case "curtain": case "double": { const m = a.add(body, a.g("mgWall", () => new THREE.BoxGeometry(1, 1, 0.2).translate(0, 0.5, 0)), veil()); m.scale.set(W, T, 1); parts.veil = m; break; }
    case "rings": { const n = Math.max(1, Math.round(W / 1.3)); for (let i = 0; i < n; i++) { const r = a.add(body, a.g("mgRing", () => new THREE.TorusGeometry(0.55, 0.09, 10, 28)), glowM(el.col), -W / 2 + (i + 0.5) * (W / n), 0.75, 0); parts[`ring${i}`] = r; } break; }
    case "lowring": { const r = a.add(body, a.g("mgArch", () => new THREE.TorusGeometry(1, 0.08, 10, 40, Math.PI)), glowM(el.col), 0, 0, 0); r.scale.set(W / 2, 0.7, 1); parts.ring0 = r; break; }
    case "highring": { const r = a.add(body, a.g("mgHalo", () => new THREE.TorusGeometry(1, 0.1, 10, 40)), glowM(el.col), 0, 0.4, 0); r.scale.set(W / 2, 0.35, 1); parts.ring0 = r; break; }
    case "pillars": { a.add(body, a.g("mgPillar", () => new THREE.CylinderGeometry(0.35, 0.45, 1, 14).translate(0, 0.5, 0)), glowM(el.col, 0.85)).scale.y = T; break; }
    case "wave": { const m = a.add(body, a.g("mgWave", () => new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)), glowM(el.col, 0.75)); m.scale.set(W * 0.6, T, 0.9); break; }
    case "bolt": { const m = a.add(body, a.g("mgBolt", () => new THREE.ConeGeometry(0.22, 1.6, 10).rotateZ(Math.PI / 2)), glowM(el.col2)); m.position.y = 0.9; break; }
    case "burst": { for (let i = 0; i < 3; i++) { const c = a.add(body, a.g("mgSpike", () => new THREE.ConeGeometry(0.22, 1.1, 6).translate(0, 0.55, 0)), glowM(el.col)); c.position.set((i - 1) * 0.4, 0, (i % 2) * 0.2); c.rotation.z = (i - 1) * 0.25; } break; }
    case "ghost": {
      a.add(body, a.g("wisp", () => new THREE.SphereGeometry(0.42, 16, 12)), a.m("wispM", () => new THREE.MeshStandardMaterial({ color: "#F2F6FF", emissive: "#BFD8FF", emissiveIntensity: 0.7, transparent: true, opacity: 0.8 })), 0, 0.75, 0).scale.set(1, 1.3, 1);
      const tail = a.add(body, a.g("wispTail", () => new THREE.ConeGeometry(0.4, 0.9, 14).rotateX(Math.PI)), a.m("wispM", () => new THREE.MeshStandardMaterial({ color: "#F2F6FF", transparent: true, opacity: 0.8 })), 0, 0.15, 0); void tail;
      for (const sx of [-1, 1]) a.add(body, a.g("wispEye", () => new THREE.SphereGeometry(0.07, 10, 8)), a.m("wispEyeM", () => new THREE.MeshBasicMaterial({ color: "#1A0A2A" })), sx * 0.13, 0.9, -0.36);
      break;
    }
    case "orb": { const m = a.add(body, a.g("mgOrb", () => new THREE.IcosahedronGeometry(0.62, 2)), glowM(el.col, 0.95), 0, 0.65, 0); parts.roll = m; break; }
    default: {
      // a thrown orb: a glowing core, a darker shell, sparks
      const core = a.add(body, a.g("mgCore", () => new THREE.IcosahedronGeometry(0.42, 2)), glowM(el.col), 0, 0.5, 0);
      a.add(core, a.g("mgShell", () => new THREE.IcosahedronGeometry(0.5, 1)), a.m(`mgS:${el.id}`, () => new THREE.MeshBasicMaterial({ color: el.col2, wireframe: true, transparent: true, opacity: 0.6 })));
      parts.spin = core;
    }
  }
  root.add(a.glowAt(el.col, Math.max(2.4, W * 1.2), 0.75, 0, 0.7, 0));
  if (o.drop) { addShadow(a, root, 1.2, parts); (parts.shadow as THREE.Mesh).material = a.m(`mgMark:${el.id}`, () => new THREE.MeshBasicMaterial({ map: glow(el.col), transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })); }
  return true;
}
const shimmerCache = new Map<string, THREE.Texture>();
function shimmer(a: string, b: string) {
  const k = a + b; const hit = shimmerCache.get(k); if (hit) return hit;
  const c = document.createElement("canvas"); c.width = 64; c.height = 128;
  const g = c.getContext("2d")!;
  const gr = g.createLinearGradient(0, 128, 0, 0); gr.addColorStop(0, a); gr.addColorStop(0.7, b); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 128);
  g.globalAlpha = 0.5; for (let i = 0; i < 40; i++) { g.fillStyle = "#FFFFFF"; g.fillRect(Math.random() * 64, Math.random() * 128, 1.5, 6 + Math.random() * 14); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; shimmerCache.set(k, t); return t;
}

// ---------------------------------------------------------------- signature obstacles that need their own look
/** looks borrowed from the base art */
const SIG_LOOK: Record<string, string> = { sideLogs: "log", tumblingBarrels: "barrel", popLogs: "log", giantHammers: "hammer", mallets: "hammer", sideRams: "log", fallingBoulders: "rock", bouncingBoulders: "rock" };
function sigArt(a: ObjectArt, o: Obj, sg: string, root: THREE.Group, parts: P): boolean {
  const W = (o.w ?? 0.6) * 2, T = o.tall ?? 1;
  switch (sg) {
    case "rollingWheels": case "snowballs": case "bombCarts": {
      const g = new THREE.Group(); g.position.y = T / 2; root.add(g); parts.roll = g;
      if (sg === "snowballs") a.add(g, a.g("snowball", () => new THREE.IcosahedronGeometry(1, 2)), a.std("#F4FAFF", { roughness: 0.9 })).scale.setScalar(T / 2);
      else if (sg === "bombCarts") { a.add(g, a.g("cartBox", () => new THREE.BoxGeometry(1, 0.7, 1.2)), a.std("#8A5A36"), 0, 0.1, 0).scale.setScalar(T / 1.6); a.add(g, a.g("bombBall", () => new THREE.SphereGeometry(0.42, 18, 14)), a.phys("#22222A"), 0, T * 0.45, 0); }
      else { const rim = a.add(g, a.g("bigWheel", () => new THREE.TorusGeometry(1, 0.16, 10, 32).rotateY(Math.PI / 2)), a.std("#3A3F4E", { metalness: 0.6, roughness: 0.4 })); rim.scale.setScalar(T / 2); for (let i = 0; i < 6; i++) { const sp = a.add(g, a.g("spoke", () => new THREE.BoxGeometry(0.08, 2, 0.08)), a.std("#C9D2DE", { metalness: 0.7 })); sp.scale.y = T / 2; sp.rotation.x = (i / 6) * Math.PI; } a.add(g, a.g("hub", () => new THREE.CylinderGeometry(0.25, 0.25, 0.4, 14).rotateZ(Math.PI / 2)), a.std("#FFD15A", { metalness: 0.6 })); }
      return true;
    }
    case "fallingLogs": case "fallingTrees": {
      const g = new THREE.Group(); root.add(g); parts.body = g;
      a.add(g, a.g("logR", () => new THREE.CylinderGeometry(1, 1, 1, 16).rotateZ(Math.PI / 2)), a.std("#8E5F38", { roughness: 0.85 }), 0, 0.35, 0).scale.set(W, 0.35, 0.35);
      if (sg === "fallingTrees") for (let i = 0; i < 3; i++) a.add(g, a.g("treeTuft", () => new THREE.IcosahedronGeometry(1, 1)), a.std("#3E8A3A"), W / 2 - 0.6 + i * 0.4, 0.7 + (i % 2) * 0.3, (i - 1) * 0.4).scale.setScalar(0.6);
      addShadow(a, root, 1.4, parts);
      return true;
    }
    case "spinningTops": { const g = new THREE.Group(); g.position.y = 0.2; root.add(g); parts.spin = g; a.add(g, a.g("topCone", () => new THREE.ConeGeometry(0.7, 1.2, 18).rotateX(Math.PI).translate(0, 0.6, 0)), a.std("#FF5A7A", { roughness: 0.3 })); a.add(g, a.g("topCap", () => new THREE.CylinderGeometry(0.7, 0.7, 0.2, 18)), a.std("#FFE066"), 0, 1.2, 0); return true; }
    case "fireWheels": { const g = new THREE.Group(); g.position.y = 1.0; root.add(g); parts.wheel = g; a.add(g, a.g("fireRing", () => new THREE.TorusGeometry(0.9, 0.14, 10, 30)), a.std("#FF8A2A", { emissive: "#FF5A1A", emissiveIntensity: 1.2 })); for (let i = 0; i < 6; i++) { const f = a.glowSprite("#FFB040", 0.9, 1); const ang = (i / 6) * Math.PI * 2; f.position.set(Math.cos(ang) * 0.9, Math.sin(ang) * 0.9, 0); g.add(f); } return true; }
    case "windmills": { const g = new THREE.Group(); g.position.y = 1.1; root.add(g); parts.wheel = g; for (let i = 0; i < 4; i++) { const b2 = a.add(g, a.g("millBladeS", () => new THREE.BoxGeometry(0.3, 1.1, 0.06).translate(0, 0.55, 0)), a.std("#FFF8EA")); b2.rotation.z = (i / 4) * Math.PI * 2; } a.add(root, a.g("millPost", () => new THREE.CylinderGeometry(0.08, 0.1, 1.1, 8).translate(0, 0.55, 0)), a.std("#8E5F38")); return true; }
    case "stompingBoots": { const g = new THREE.Group(); root.add(g); parts.block = g; a.add(g, a.g("boot", () => new THREE.BoxGeometry(1, 0.6, 1.5)), a.std("#6B4A2E", { roughness: 0.7 }), 0, 0.3, -0.1).scale.set(W * 0.9, 1, 1); a.add(g, a.g("bootLeg", () => new THREE.CylinderGeometry(0.4, 0.45, 2.4, 14).translate(0, 1.8, 0)), a.std("#6B4A2E"), 0, 0, 0.2); return true; }
    default: return false;
  }
}

function addShadow(a: ObjectArt, root: THREE.Group, size: number, parts: P) {
  const sh = new THREE.Mesh(a.g("dropShadow", () => new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2)), a.m("dropShadowM", () => new THREE.MeshBasicMaterial({ map: glow("#000000"), transparent: true, opacity: 0.6, depthWrite: false })));
  sh.scale.setScalar(size); sh.position.y = 0.03; root.add(sh); parts.shadow = sh;
}
function friendBlob(a: ObjectArt, root: THREE.Object3D, col: string, r: number, y: number, parts: P, x = 0, z = 0, i = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); root.add(g); parts[`blob${i}`] = g;
  a.add(g, a.g("friendBlob", () => new THREE.SphereGeometry(1, 18, 14)), a.std(col, { roughness: 0.35 }), 0, 0, 0).scale.set(r, r * 0.9, r);
  for (const sx of [-1, 1]) { a.add(g, a.g("eyeW", () => new THREE.SphereGeometry(0.09, 12, 10)), a.std("#FFFFFF", { roughness: 0.2 }), sx * r * 0.35, r * 0.2, -r * 0.85).scale.setScalar(r * 1.6); a.add(g, a.g("eyeP", () => new THREE.SphereGeometry(0.045, 10, 8)), a.std("#1A1420"), sx * r * 0.35, r * 0.2, -r * 0.97).scale.setScalar(r * 1.6); }
}
/** a Clanker: a tin-toy body in its look's colours with its own topper (claws, spikes, cannon, jaws, magnet, shield…) */
function clankerArt(a: ObjectArt, o: Obj, root: THREE.Group, parts: P) {
  const look = o.look ?? "E04";
  const [c1, c2, c3] = BOT_COL[look] ?? ["#C9D2DE", "#E8504F", "#FFD15A"];
  const big = (o.w ?? 0.6) > 0.9 && look !== "E21" && look !== "E15" && look !== "car";
  const wide = look === "E21" || look === "E15" || (o.tall ?? 1) < 0.7;
  const s = big ? 1.6 : 1;
  const body = new THREE.Group(); body.position.y = 0.55 * s; root.add(body); parts.body = body;
  if (wide) {
    // a stack / jelly / rolling bar across the track: a row of little bots
    const W = (o.w ?? 1) * 2, n = Math.max(1, Math.round(W / 1.1));
    for (let i = 0; i < n; i++) { const x = -W / 2 + (i + 0.5) * (W / n); a.add(body, a.g("clankTin", () => new THREE.CylinderGeometry(0.36, 0.36, 0.62, 18)), a.phys(i % 2 ? c1 : c2), x, -0.2, 0).scale.set(1, 0.8, 1); a.eyes(body, -0.05, -0.33, 0.1); body.children[body.children.length - 1].position.x += x; }
    return;
  }
  const shape = look === "E18" || look === "E27" || look === "car" ? "box" : look === "E15" || look === "E19" ? "ball" : "can";
  if (shape === "box") a.add(body, a.g("clankBox", () => new THREE.BoxGeometry(1, 0.8, 1)), a.phys(c1), 0, 0, 0).scale.set(0.9 * s, s, 0.8 * s);
  else if (shape === "ball") a.add(body, a.g("clankBall", () => new THREE.SphereGeometry(0.42, 18, 14)), a.phys(c1), 0, 0, 0).scale.setScalar(s);
  else a.add(body, a.g("clankTin", () => new THREE.CylinderGeometry(0.36, 0.36, 0.62, 18)), a.phys(c1), 0, 0, 0).scale.setScalar(s);
  a.add(body, a.g("canBand", () => new THREE.CylinderGeometry(0.375, 0.375, 0.16, 20)), a.std(c2, { roughness: 0.35 }), 0, 0.06 * s, 0).scale.setScalar(s * (shape === "box" ? 1.25 : 1));
  a.eyes(body, 0.12 * s, -0.33 * s - (shape === "box" ? 0.08 : 0), 0.1 * s);
  const top = new THREE.Group(); top.position.y = 0.35 * s; body.add(top); parts.top = top;
  switch (look) {
    case "E04": for (const sx of [-1, 1]) a.add(body, a.g("claw", () => new THREE.SphereGeometry(0.22, 12, 10)), a.phys(c3), sx * 0.55, 0, -0.1).scale.set(0.8, 1.2, 0.7); break;
    case "E05": for (let i = 0; i < 7; i++) { const sp = a.add(top, a.g("cSpike", () => new THREE.ConeGeometry(0.08, 0.3, 6)), a.phys(c3), Math.cos(i) * 0.22, 0.1, Math.sin(i) * 0.22); sp.rotation.z = Math.cos(i) * 0.4; } break;
    case "E06": a.add(top, a.g("cCannon", () => new THREE.CylinderGeometry(0.12, 0.15, 0.5, 12).rotateX(Math.PI / 2)), a.phys(c2), 0, 0.05, -0.3); break;
    case "E07": for (const sy of [-1, 1]) a.add(body, a.g("jaw", () => new THREE.BoxGeometry(0.7, 0.08, 0.3)), a.std(c3), 0, sy * 0.15, -0.45); break;
    case "E08": a.add(top, a.g("magnetU", () => new THREE.TorusGeometry(0.2, 0.07, 8, 16, Math.PI)), a.std(c1), 0, 0.15, 0); break;
    case "E09": a.add(body, a.g("shield", () => new THREE.CylinderGeometry(0.55, 0.55, 0.08, 20).rotateX(Math.PI / 2)), a.phys(c3), 0, 0, -0.5); break;
    case "E10": a.add(top, a.g("drillTip", () => new THREE.ConeGeometry(0.22, 0.5, 12)), a.phys(c3), 0, 0.2, 0); break;
    case "E11": case "E12": body.add(a.glowAt(look === "E11" ? "#BFE8FF" : "#FF8A2A", 1.8, 0.7, 0, -0.4, 0.3)); break;
    case "E13": for (const sx of [-1, 1]) { const w2 = a.add(top, a.g("gullWing", () => new THREE.BoxGeometry(0.7, 0.04, 0.25).translate(0.35, 0, 0)), a.std("#FFFFFF"), 0, 0, 0); w2.rotation.y = sx > 0 ? 0 : Math.PI; parts[`wing${sx}`] = w2; } break;
    case "E17": body.add(a.glowAt("#FFE08A", 2, 0.8, 0, 0, 0)); break;
    case "E20": case "E22": case "E30": { const rot = new THREE.Group(); rot.position.y = 0.15; top.add(rot); parts.rotor = rot; for (let i = 0; i < 3; i++) { const bl = a.add(rot, a.g("blade", () => new THREE.BoxGeometry(0.9, 0.02, 0.12).translate(0.45, 0, 0)), a.std("#2E2A33")); bl.rotation.y = (i / 3) * Math.PI * 2; } break; }
    case "E23": a.add(body, a.g("laserEye", () => new THREE.SphereGeometry(0.16, 12, 10)), a.std("#FF3A3A", { emissive: "#FF3A3A", emissiveIntensity: 1.5 }), 0, 0.12, -0.36); break;
    case "E25": a.add(top, a.g("rayDish", () => new THREE.ConeGeometry(0.25, 0.3, 14, 1, true).rotateX(-Math.PI / 2)), a.std(c2, { side: THREE.DoubleSide }), 0, 0, -0.2); break;
    case "E28": a.add(top, a.g("spoiler", () => new THREE.BoxGeometry(0.8, 0.05, 0.2)), a.std(c3), 0, 0.1, 0.3); break;
    case "thief": a.add(body, a.g("mask", () => new THREE.BoxGeometry(0.74, 0.12, 0.05)), a.std("#2B2B33"), 0, 0.13, -0.37); a.add(top, a.g("sack", () => new THREE.SphereGeometry(0.25, 12, 10)), a.std("#A8743A"), 0, 0.1, 0.25); break;
    default: { const key = new THREE.Group(); key.position.set(0, 0.05, 0.38 * s); body.add(key); parts.key = key; a.add(key, a.g("keyWing", () => new THREE.TorusGeometry(0.1, 0.035, 8, 14)), a.phys("#FFC94A"), 0, 0, 0.1).rotation.y = Math.PI / 2; }
  }
  if (look === "E16" || look === "E29" || look === "E25") body.add(a.glowAt(c2, 1.8, 0.5, 0, 0, 0));
}

/** rails, painted zones and lane dividers run along the track: built once in world space */
function buildLong(a: ObjectArt, o: Obj, root: THREE.Group) {
  root.userData.world = true;
  const tr = a.tr, s0 = o.s - (o.ds ?? 5), s1 = o.s + (o.ds ?? 5), step = 1.5;
  const P = [0, 0, 0];
  if (o.k === "rail") {
    const pts: THREE.Vector3[] = [];
    for (let s = s0; s <= s1 + 0.01; s += step) { tr.point(s, o.u, o.h, P); pts.push(new THREE.Vector3(P[0], P[1], P[2])); }
    if (pts.length < 2) return;
    const curve = new THREE.CatmullRomCurve3(pts);
    const col = o.look === "vine" ? "#5C8A3A" : o.look === "light" ? "#7FE8FF" : o.look === "pipe" ? "#5A6AF0" : o.look === "boost" ? "#5CF2C9" : o.look === "coaster" ? "#FF5A7A" : "#C9D2DE";
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(4, pts.length * 2), o.look === "pipe" ? 0.22 : 0.1, 8, false), o.look === "light" || o.look === "boost" ? a.std(col, { emissive: col, emissiveIntensity: 0.9 }) : a.phys(col));
    root.add(tube); (root.userData.geos ??= []).push(tube.geometry);
    // posts every few metres (not over open sky)
    for (let s = s0 + 1; s < s1; s += 6) { tr.point(s, o.u, 0, P); const post = a.add(root, a.g("railPost", () => new THREE.CylinderGeometry(0.05, 0.06, 1, 6).translate(0, 0.5, 0)), a.std("#3A3F4E")); post.position.set(P[0], P[1], P[2]); post.scale.y = o.h; }
    return;
  }
  const half = o.w ?? 1, lift = o.k === "divider" ? 0 : 0.03, tall = o.k === "divider" ? o.tall ?? 0.9 : 0;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  let n = 0;
  for (let s = s0; s <= s1 + 0.01; s += step) {
    const t = (s - s0) / 2;
    if (o.k === "divider") {
      tr.point(s, o.u, 0, P); pos.push(P[0], P[1], P[2]); tr.point(s, o.u, tall, P); pos.push(P[0], P[1], P[2]);
    } else {
      tr.point(s, o.u - half, lift, P); pos.push(P[0], P[1], P[2]); tr.point(s, o.u + half, lift, P); pos.push(P[0], P[1], P[2]);
    }
    uv.push(0, t, 1, t);
    if (n > 0) { const b = (n - 1) * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    n++;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  (root.userData.geos ??= []).push(geo);
  if (o.k === "divider") { root.add(new THREE.Mesh(geo, a.m("dividerM", () => new THREE.MeshStandardMaterial({ map: stripes("#FFE066", "#3A3F4E"), roughness: 0.5, side: THREE.DoubleSide })))); return; }
  const [col, op] = ZONE_COL[o.zone ?? "slow"] ?? ["#FFFFFF", 0.3];
  const animated = o.zone === "belt" || o.zone === "fast" || o.zone === "wind" || o.zone === "headwind" || o.zone === "updraft";
  const mat = a.m(`zoneM${o.zone}`, () => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, map: animated ? stripes("#FFFFFF", "#7A8AA0") : null, blending: o.zone === "lava" || o.zone === "zap" || o.zone === "fast" ? THREE.AdditiveBlending : THREE.NormalBlending }));
  const mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = 2; root.add(mesh); root.userData.zoneMat = mat;
}

/** per-frame motion of the Phase 2–3 kinds; `on` = the blink state now */
export function animateMore(v: View, dt: number, t: number, on: boolean) {
  const o = v.o, p = v.parts;
  if (v.root.userData.custom) {
    for (let i = 0; i < 6; i++) { const r = p[`ring${i}`]; if (r) r.rotation.z = t * (i % 2 ? 2 : -2); }
    if (p.veil) { const m = (p.veil as THREE.Mesh).material as THREE.MeshBasicMaterial; if (m.map) m.map.offset.y = -t * 0.6; p.veil.visible = on; }
    if (p.roll) p.roll.rotation.x -= dt * 6;
    if (p.wheel) p.wheel.rotation.z += dt * 4;
    if (p.spin) p.spin.rotation.y += dt * (o.k === "item" ? 2 : 6);
    if (p.block) { const k = on ? 0 : 2.4; p.block.position.y += (k - p.block.position.y) * Math.min(1, dt * 14); }
    if (o.k === "crusher" || o.k === "door" || o.k === "fire" || o.k === "geyser" || o.k === "laser") { if (p.body) p.body.visible = on || !o.blink; }
    if ((o.k === "faller" || o.k === "bomb") && p.shadow) p.shadow.visible = true;
    return;
  }
  if (p.spin) p.spin.rotation.y = t * 2.2;
  if (p.spin && (o.k === "item" || o.k === "power")) p.spin.position.y = 0.5 + Math.sin(t * 2.4 + o.s) * 0.12;
  if (p.orb) { p.orb.rotation.y = t; p.orb.position.y = 0.6 + Math.sin(t * 2.4 + o.s) * 0.12; }
  switch (o.k) {
    case "bomb": if (p.spark) (p.spark as THREE.Sprite).scale.setScalar(0.6 + Math.random() * 0.5); break;
    case "laser": if (p.beam) p.beam.visible = on; if (p.glow) (p.glow as THREE.Sprite).material.opacity = on ? 0.45 : 0.08; break;
    case "fire": if (p.flame && p.core) { p.flame.visible = on; p.core.visible = on; p.flame.scale.y = 2.4 + Math.sin(t * 20) * 0.3; } break;
    case "crusher": { if (!p.block) break; const k = on ? 0 : 2.4; p.block.position.y += (k - p.block.position.y) * Math.min(1, dt * 14); break; }
    case "door": { if (!p.dl) break; const k = on ? 0 : 1.6; p.dl.position.x += (-k - p.dl.position.x) * Math.min(1, dt * 10); p.dr.position.x += (k - p.dr.position.x) * Math.min(1, dt * 10); break; }
    case "roller": if (p.roll) p.roll.rotation.x -= dt * 7; break;
    case "saw": if (p.spin) { p.spin.rotation.x -= dt * 10; p.spin.rotation.y = 0; } break;
    case "mine": if (!p.body) break; p.body.position.y = 0.45 + Math.sin(t * 2 + o.s) * 0.12; p.body.rotation.y = t; break;
    case "swing": if (!p.head) break; p.head.rotation.z = Math.sin(t * 2 + o.s) * 0.25; break;
    case "bumper": if (!p.rim) break; (p.rim as THREE.Mesh).scale.setScalar(1 + Math.max(0, v.hit) * 0.3); v.hit = Math.max(0, v.hit - dt * 3); break;
    case "geyser": if (p.jet) { p.jet.visible = on || o.look !== "blast"; p.jet.scale.y = 2.6 + Math.sin(t * 12) * 0.4; } break;
    case "balloon": if (!p.body) break; p.body.position.y = Math.sin(t * 2 + o.s) * 0.2; break;
    case "tele": if (!p.swirl) break; p.swirl.rotation.z = t * 3; break;
    case "hoop": if (!p.ring) break; p.ring.rotation.z = t; break;
    case "bell": if (!p.body) break; p.body.rotation.z = Math.sin(t * 3 + o.s) * 0.2; break;
    case "carry": if (!p.body) break; p.body.position.y = Math.sin(t * 1.6) * 0.15; break;
    case "pole": if (!p.ring) break; p.ring.rotation.y = t * 3; break;
    case "gate": if (p.panel) p.panel.visible = on; break;
    case "switch": case "plate": if (p.btn) (p.btn as THREE.Mesh).position.y = 0.16 + Math.sin(t * 4) * 0.02; break;
    case "clanker": {
      if (p.body) { p.body.rotation.z = Math.sin(t * 8 + o.s) * 0.06; p.body.position.y = p.body.position.y * 0.9 + (0.55 + Math.abs(Math.sin(t * 8)) * 0.04) * 0.1 * (p.body.position.y > 0.7 ? 1.6 : 1); }
      if (p.rotor) p.rotor.rotation.y += dt * 30;
      if (p.key) p.key.rotation.z += dt * 4;
      if (p.wing1) { p.wing1.rotation.z = Math.sin(t * 10) * 0.5; p["wing-1"].rotation.z = -Math.sin(t * 10) * 0.5; }
      if (o.look === "E17") v.root.visible = true;
      break;
    }
    case "friend": for (let i = 0; i < 5; i++) { const b = p[`blob${i}`]; if (b) b.position.y = 0.45 + Math.abs(Math.sin(t * 6 + i)) * 0.25; } break;
    case "critter": if (!p.body) break; p.body.rotation.x = Math.sin(t * 3) * 0.4; break;
    case "zone": { const m = v.root.userData.zoneMat as THREE.MeshBasicMaterial | undefined; if (m?.map) m.map.offset.y -= dt * (o.zone === "belt" ? 1.5 : 3); if (m) m.visible = on; break; }
    default: break;
  }
  if ((o.k === "faller" || o.k === "bomb") && p.shadow) p.shadow.visible = true;
}

// ---------------------------------------------------------------- the Kranky machines (worlds 3–25)
type Body = "sphere" | "box" | "capsule" | "cylinder" | "cone" | "icosa" | "ellipsoid";
interface Mach { body: Body; col: string; trim: string; size: [number, number, number]; y: number; spinner?: "fan" | "blades" | "drill" | "rotor" | "wheel"; legs?: number; arms?: boolean; extra?: "dome" | "chimney" | "lure" | "kiteTail" | "segments" | "treads" | "towers" | "cap" | "blade" }
const MACH: Record<string, Mach> = {
  sub: { body: "capsule", col: "#5A7AA0", trim: "#FFD15A", size: [1.6, 1.4, 3.4], y: 2.2, spinner: "wheel", extra: "chimney" },
  gumball: { body: "sphere", col: "#FF5A7A", trim: "#FFFFFF", size: [2.2, 2.2, 2.2], y: 3.2, legs: 2, extra: "dome" },
  bopper: { body: "cylinder", col: "#5CB85C", trim: "#2B2B33", size: [1.3, 3.4, 1.3], y: 2.4, legs: 2, arms: true },
  golem: { body: "icosa", col: "#B89CFF", trim: "#7FE8FF", size: [2.4, 2.6, 2.0], y: 3, legs: 2, arms: true },
  tank: { body: "box", col: "#3A3F4E", trim: "#FF5AD8", size: [3.4, 1.6, 3.6], y: 1.2, extra: "treads", spinner: "rotor" },
  plough: { body: "box", col: "#FF8A3A", trim: "#FFFFFF", size: [3.6, 2.0, 3.0], y: 1.4, extra: "blade", spinner: "wheel" },
  zeppelin: { body: "ellipsoid", col: "#E8504F", trim: "#FFD15A", size: [2.4, 2.0, 5.0], y: 6, spinner: "fan" },
  drill: { body: "cylinder", col: "#7C8899", trim: "#FF6A2A", size: [1.6, 2.4, 1.6], y: 2.2, spinner: "drill", arms: true },
  guardian: { body: "box", col: "#8A8070", trim: "#5CF2C9", size: [2.6, 3.2, 1.6], y: 3, legs: 2, arms: true },
  worm: { body: "sphere", col: "#E8C08A", trim: "#A8743A", size: [1.8, 1.8, 1.8], y: 1.6, extra: "segments" },
  mecha: { body: "box", col: "#7A5CFF", trim: "#FFD15A", size: [2.6, 2.8, 2.0], y: 3.4, legs: 2, arms: true, spinner: "wheel" },
  coaster: { body: "box", col: "#FF5A7A", trim: "#FFE066", size: [3.0, 1.6, 3.6], y: 1.2, extra: "treads" },
  angler: { body: "ellipsoid", col: "#2B2B4A", trim: "#7FE8FF", size: [2.6, 2.2, 3.4], y: 2.4, extra: "lure" },
  blower: { body: "cylinder", col: "#C98A4A", trim: "#FFE066", size: [2.0, 2.4, 2.0], y: 2.2, spinner: "fan", legs: 2 },
  turbine: { body: "cylinder", col: "#9FB8D8", trim: "#FFE066", size: [1.4, 5.0, 1.4], y: 3.4, spinner: "blades" },
  mushroom: { body: "cylinder", col: "#FFF2D8", trim: "#B89CFF", size: [1.6, 2.6, 1.6], y: 2.8, legs: 2, extra: "cap" },
  knight: { body: "box", col: "#C9D2DE", trim: "#FFD15A", size: [2.2, 3.0, 1.6], y: 3.2, legs: 2, arms: true, spinner: "wheel" },
  racer: { body: "box", col: "#FF5A7A", trim: "#7FE8FF", size: [2.6, 1.0, 4.4], y: 0.9, extra: "treads" },
  train: { body: "box", col: "#3A2A4A", trim: "#9FFFE0", size: [3.0, 2.6, 5.0], y: 1.6, extra: "chimney", spinner: "wheel" },
  cannon: { body: "sphere", col: "#3A3F4E", trim: "#FFB347", size: [2.4, 2.4, 2.4], y: 2.6, extra: "chimney", spinner: "rotor" },
  snake: { body: "box", col: "#5CF2C9", trim: "#FF5AD8", size: [1.6, 1.6, 1.6], y: 1.4, extra: "segments" },
  kite: { body: "cone", col: "#FF8FC8", trim: "#FFE066", size: [3.0, 0.3, 3.4], y: 5, extra: "kiteTail" },
  fortress: { body: "box", col: "#4A4F5E", trim: "#FF5A7A", size: [4.6, 4.6, 3.4], y: 3.6, extra: "towers", spinner: "rotor", arms: true },
};
export function bossMore(a: ObjectArt, kind: string): { root: THREE.Group; parts: P } {
  const root = new THREE.Group(), parts: P = {};
  const M = MACH[kind] ?? MACH.mecha;
  const body = new THREE.Group(); body.position.y = M.y; root.add(body); parts.body = body;
  const [sx, sy, sz] = M.size;
  const geo = M.body === "box" ? a.g("bossBox", () => new THREE.BoxGeometry(1, 1, 1)) : M.body === "cylinder" ? a.g("bossCyl", () => new THREE.CylinderGeometry(0.5, 0.55, 1, 22)) : M.body === "cone" ? a.g("bossCone", () => new THREE.ConeGeometry(0.5, 1, 4)) : M.body === "icosa" ? a.g("bossIco", () => new THREE.IcosahedronGeometry(0.55, 0)) : M.body === "capsule" ? a.g("bossCap", () => new THREE.CapsuleGeometry(0.5, 1, 8, 16).rotateX(Math.PI / 2)) : a.g("bossSph", () => new THREE.SphereGeometry(0.5, 28, 20));
  const hull = a.add(body, geo, a.phys(M.col)); hull.scale.set(sx, M.body === "capsule" ? sy : sy, M.body === "capsule" ? sz / 2 : sz);
  if (M.body === "cone") hull.rotation.x = Math.PI / 2;
  a.add(body, a.g("bossBand", () => new THREE.TorusGeometry(0.5, 0.06, 8, 32).rotateX(Math.PI / 2)), a.std(M.trim, { emissive: M.trim, emissiveIntensity: 0.4 }), 0, 0, 0).scale.set(sx * 1.05, 1, sz * 1.05 * (M.body === "box" ? 1 : 1));
  // eyes on the front, angry brows
  for (const e of [-1, 1]) {
    a.add(body, a.g("bigEye", () => new THREE.SphereGeometry(0.32, 16, 12)), a.std("#FFFFFF", { roughness: 0.2 }), e * sx * 0.22, sy * 0.18, -sz * 0.5 - 0.05);
    a.add(body, a.g("bigPupil", () => new THREE.SphereGeometry(0.15, 12, 10)), a.std("#1A1420"), e * sx * 0.22, sy * 0.18, -sz * 0.5 - 0.3);
    const brow = a.add(body, a.g("bossBrow", () => new THREE.BoxGeometry(0.6, 0.1, 0.1)), a.std("#1A1420"), e * sx * 0.22, sy * 0.18 + 0.42, -sz * 0.5 - 0.15); brow.rotation.z = e * 0.35;
  }
  // the weak spot: a glowing core on the front, low
  const weak = a.add(body, a.g("weak", () => new THREE.SphereGeometry(0.6, 18, 12)), a.std("#7DFFE0", { emissive: "#3AFFC8", emissiveIntensity: 1.3 }), 0, -sy * 0.25, -sz * 0.5 - 0.1);
  parts.weak = weak;
  if (M.spinner) {
    const sp = new THREE.Group(); parts.spin = sp;
    if (M.spinner === "fan" || M.spinner === "blades") { sp.position.set(0, M.spinner === "blades" ? sy * 0.5 : 0, M.spinner === "blades" ? -0.8 : sz * 0.5 + 0.2); body.add(sp); for (let i = 0; i < (M.spinner === "blades" ? 3 : 5); i++) { const bl = a.add(sp, a.g(M.spinner === "blades" ? "turbBlade" : "fanBlade", () => new THREE.BoxGeometry(M.spinner === "blades" ? 0.5 : 0.35, M.spinner === "blades" ? 3.6 : 1.2, 0.08).translate(0, M.spinner === "blades" ? 1.8 : 0.6, 0)), a.std(M.trim)); bl.rotation.z = (i / (M.spinner === "blades" ? 3 : 5)) * Math.PI * 2; } }
    else if (M.spinner === "drill") { sp.position.set(0, -sy * 0.5, -sz * 0.2); body.add(sp); a.add(sp, a.g("bossDrill", () => new THREE.ConeGeometry(0.8, 2, 14).rotateX(Math.PI)), a.phys(M.trim), 0, -1, 0); }
    else if (M.spinner === "rotor") { sp.position.y = sy * 0.55; body.add(sp); for (let i = 0; i < 3; i++) { const bl = a.add(sp, a.g("blade", () => new THREE.BoxGeometry(0.9, 0.02, 0.12).translate(0.45, 0, 0)), a.std("#2E2A33")); bl.scale.set(3, 1, 2); bl.rotation.y = (i / 3) * Math.PI * 2; } }
    else { sp.position.set(0, 0, sz * 0.5 + 0.4); body.add(sp); a.add(sp, a.g("bkStem", () => new THREE.CylinderGeometry(0.12, 0.12, 0.8, 10).rotateX(Math.PI / 2)), a.phys("#FFC94A"), 0, 0, 0.3); for (const k of [-1, 1]) a.add(sp, a.g("bkWing", () => new THREE.TorusGeometry(0.4, 0.12, 8, 16)), a.phys("#FFC94A"), k * 0.45, 0, 0.7).rotation.y = Math.PI / 2; }
  }
  for (let i = 0; i < (M.legs ?? 0); i++) { const k = i ? 1 : -1; const leg = new THREE.Group(); leg.position.set(k * sx * 0.3, -sy * 0.45, 0); body.add(leg); parts[`leg${k}`] = leg; a.add(leg, a.g("millLeg", () => new THREE.CylinderGeometry(0.3, 0.4, 2.8, 10).translate(0, -1.4, 0)), a.phys("#7C8899")).scale.y = Math.max(0.4, (M.y - sy * 0.45) / 2.8); a.add(leg, a.g("millFoot", () => new THREE.BoxGeometry(1, 0.4, 1.4)), a.phys("#3A3F4E"), 0, -(M.y - sy * 0.45) + 0.2, -0.2); }
  if (M.arms) for (const k of [-1, 1]) { const arm = new THREE.Group(); arm.position.set(k * sx * 0.55, sy * 0.1, 0); body.add(arm); parts[`arm${k}`] = arm; a.add(arm, a.g("crabArm", () => new THREE.CylinderGeometry(0.22, 0.26, 1.6, 10).rotateZ(Math.PI / 2)), a.phys(M.col), k * 0.8, 0, 0); a.add(arm, a.g("fist", () => new THREE.SphereGeometry(0.45, 14, 10)), a.phys(M.trim), k * 1.7, 0, 0); }
  switch (M.extra) {
    case "dome": a.add(body, a.g("gumDome", () => new THREE.SphereGeometry(0.5, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2)), a.m("gumDomeM", () => new THREE.MeshPhysicalMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.35, roughness: 0.02, clearcoat: 1 })), 0, sy * 0.4, 0).scale.setScalar(sx * 0.9); for (let i = 0; i < 9; i++) a.add(body, a.g("gumball", () => new THREE.SphereGeometry(0.22, 10, 8)), a.std(["#FF5A7A", "#5CF2C9", "#FFE066"][i % 3]), Math.cos(i) * 0.5, sy * 0.45 + (i % 3) * 0.2, Math.sin(i) * 0.5); break;
    case "chimney": a.add(body, a.g("chimney", () => new THREE.CylinderGeometry(0.3, 0.4, 1.4, 12)), a.phys(M.trim), 0, sy * 0.5 + 0.6, -sz * 0.25); body.add(a.glowAt(M.trim, 2.4, 0.5, 0, sy * 0.5 + 1.4, -sz * 0.25)); break;
    case "lure": { const lure = a.add(body, a.g("lure", () => new THREE.SphereGeometry(0.3, 14, 10)), a.std("#FFF2A0", { emissive: "#FFE08A", emissiveIntensity: 2 }), 0, sy * 0.6, -sz * 0.7); parts.lure = lure; body.add(a.glowAt("#FFF2A0", 4, 0.8, 0, sy * 0.6, -sz * 0.7)); break; }
    case "kiteTail": for (let i = 0; i < 6; i++) a.add(body, a.g("kiteBow", () => new THREE.BoxGeometry(0.5, 0.06, 0.25)), a.std(i % 2 ? M.trim : "#FFFFFF"), 0, -0.2 - i * 0.1, sz * 0.4 + i * 0.6); break;
    case "segments": for (let i = 1; i < 6; i++) { const sg = a.add(body, M.body === "box" ? a.g("bossBox", () => new THREE.BoxGeometry(1, 1, 1)) : a.g("bossSph", () => new THREE.SphereGeometry(0.5, 28, 20)), a.phys(i % 2 ? M.trim : M.col), 0, -i * 0.12, sz * 0.55 * i); sg.scale.setScalar(sx * (1 - i * 0.1)); parts[`seg${i}`] = sg; } break;
    case "treads": for (const k of [-1, 1]) a.add(body, a.g("tread", () => new THREE.BoxGeometry(0.6, 0.8, 1).translate(0, -0.4, 0)), a.std("#2B2B33", { roughness: 0.8 }), k * sx * 0.5, -sy * 0.4, 0).scale.z = sz * 1.05; break;
    case "towers": for (const k of [-1, 1]) { a.add(body, a.g("fTower", () => new THREE.CylinderGeometry(0.7, 0.8, 1, 12).translate(0, 0.5, 0)), a.phys("#5A5F6E"), k * sx * 0.45, sy * 0.5, 0).scale.y = 2.6; a.add(body, a.g("fRoof", () => new THREE.ConeGeometry(0.9, 1.2, 12)), a.std(M.trim), k * sx * 0.45, sy * 0.5 + 3.2, 0); } break;
    case "cap": a.add(body, a.g("shroomCap", () => new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2)), a.std(M.trim, { emissive: M.trim, emissiveIntensity: 0.4 }), 0, sy * 0.45, 0).scale.set(2.6, 1.6, 2.6); break;
    case "blade": { const b2 = a.add(body, a.g("ploughBlade", () => new THREE.BoxGeometry(1, 1, 0.2)), a.phys("#C9D2DE"), 0, -sy * 0.2, -sz * 0.5 - 0.6); b2.scale.set(sx * 1.4, sy * 0.7, 1); b2.rotation.x = 0.4; break; }
    default: break;
  }
  root.add(a.glowAt("#FF8A5A", 10, 0.25, 0, 3, 0));
  root.traverse((x) => { (x as THREE.Mesh).castShadow = (x as THREE.Mesh).isMesh; });
  return { root, parts };
}
export function animateBossMore(kind: string, parts: P, t: number, mood: string) {
  const M = MACH[kind] ?? MACH.mecha, tired = mood === "tired";
  parts.body.position.y = M.y + (tired ? -Math.min(0.8, M.y * 0.4) : Math.abs(Math.sin(t * 5)) * 0.25) + (M.body === "ellipsoid" && kind === "zeppelin" ? Math.sin(t) * 0.6 : 0);
  parts.body.rotation.z = tired ? Math.sin(t * 3) * 0.1 : Math.sin(t * 4) * 0.05;
  if (parts.spin) { if (M.spinner === "drill") parts.spin.rotation.y += tired ? 0.02 : 0.4; else if (M.spinner === "rotor") parts.spin.rotation.y += tired ? 0.05 : 0.5; else parts.spin.rotation.z += tired ? 0.01 : 0.15; }
  for (const k of [-1, 1]) {
    if (parts[`leg${k}`]) parts[`leg${k}`].rotation.x = tired ? 0 : Math.sin(t * 5 + (k > 0 ? Math.PI : 0)) * 0.5;
    if (parts[`arm${k}`]) parts[`arm${k}`].rotation.z = tired ? k * 0.6 : k * (0.2 + Math.sin(t * 4 + k) * 0.4);
  }
  for (let i = 1; i < 6; i++) { const sg = parts[`seg${i}`]; if (sg) sg.position.x = Math.sin(t * 4 - i * 0.7) * 0.6; }
  if (parts.lure) parts.lure.position.y = (MACH.angler.size[1] * 0.6) + Math.sin(t * 3) * 0.3;
  const w = parts.weak as THREE.Mesh | undefined;
  if (w) w.scale.setScalar(tired ? 1.25 + Math.sin(t * 12) * 0.15 : 0.9);
}
