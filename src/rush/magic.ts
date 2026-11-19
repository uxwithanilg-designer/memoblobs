// Mayamma's spellbook, the signature obstacle of every stage, and the treasure on it.
//
// A magic is an element (fire, ice, poison, lightning, shadow, thorn, water, light, stone, star, rainbow) with a spell
// form (bomb rain, a curtain with one gap, ring walls, rings to hop or curl under, rolling orbs, waves, puddles, ground
// bursts…): 11 × 20 = 220 different named magics. On the track a magic is ordinary hazards — thrown from her hands,
// they land a little before Rollo gets there — with the intents the fairness bot follows, so every witch stretch is
// checked like everything else. Every second stage she flies in for a stretch of 5–10 of them.
//
// Every stage also has its own big obstacle (logs that pop up from below, pillars that rise, logs and rams from the
// side, boulders and logs from above, giant hammers, rolling wheels, fire wheels…) — 30 kinds, a different one each
// stage — and treasure: gold coins, a heart now and then, and power orbs.
import { G, STEER, air, type B, type Section } from "./gen";
import type { Obj, ObjKind, PowerKind } from "./types";

import { ELEMENTS, FORMS, sigOf } from "./magicdata";
export { ELEMENTS, FORMS, MAGICS, MAGIC_NAME, SIGS, elementOf, sigOf } from "./magicdata";

// ---------------------------------------------------------------- placing hazards
const lanesOf = (b: B) => [-2.4, 0, 2.4].filter((u) => Math.abs(u) < b.half() + 0.6);
/** the lane nearest `from`, but a random one now and then */
function pickFree(b: B, from: number) { const L = lanesOf(b); const near = L.reduce((x, u) => (Math.abs(u - from) < Math.abs(x - from) ? u : x), L[0]); return b.rng.chance(0.55) ? near : b.rng.pick(L); }
/** blockers in every lane but `free` */
function row(b: B, s: number, k: ObjKind, free: number, more: Partial<Obj>, w = 0.85) {
  for (const u of lanesOf(b)) if (u !== free) b.add(k, s, u, more.h ?? 0, { ds: 0.6, w, tall: 1.0, harm: true, ...more });
}
/** a strip across the whole width with one gap at `g` */
function strip(b: B, s: number, k: ObjKind, g: number, more: Partial<Obj>, gw = 2.6) {
  const L = -b.width / 2, R = b.width / 2;
  if (g - gw / 2 - L > 0.4) b.add(k, s, (L + g - gw / 2) / 2, 0, { ds: 0.35, w: (g - gw / 2 - L) / 2, tall: 1.6, harm: true, ...more });
  if (R - (g + gw / 2) > 0.4) b.add(k, s, (R + g + gw / 2) / 2, 0, { ds: 0.35, w: (R - g - gw / 2) / 2, tall: 1.6, harm: true, ...more });
}
const thrown = (b: B) => ({ drop: 24, land: Math.max(8, b.R * 0.65) });

/** cast one magic with its hazards starting near s; `last` = where the runner was last sent (lateral) */
export function castMagic(b: B, id: string, s: number, gap: number, last: number): number {
  const [eid, fid] = id.split(":");
  const el = ELEMENTS.find((e) => e.id === eid) ?? ELEMENTS[0];
  const look = `mg:${el.id}:${fid}`;
  const lead = gap * 0.75;
  const steer = (at: number, u: number, until = at + 1.2) => { b.steerTo(at - lead, u, until); return u; };
  const curl = b.moves.curl;
  const half = b.half();
  switch (fid) {
    case "rain": case "meteors": case "spears": {
      const free = pickFree(b, last);
      row(b, s, fid === "rain" ? el.drop : "faller", free, { look, ...thrown(b), tall: fid === "spears" ? 1.4 : 1 });
      return steer(s, free);
    }
    case "curtain": case "rings": {
      const g = Math.max(-half + 0.8, Math.min(half - 0.8, last + (b.rng.next() * 2 - 1) * Math.min(STEER * (gap / b.v) * 0.6, b.width * 0.6)));
      strip(b, s, "laser", g, { look, ...thrown(b) });
      return steer(s, g);
    }
    case "lowring": b.add("wall", s, 0, 0, { ds: 0.35, w: b.width / 2, tall: 0.65, harm: true, look, ...thrown(b) }); b.jumpAt(s - 0.35); return last;
    case "highring": case "halo": {
      if (fid === "halo") { b.add("wall", s, 0, 0, { ds: 0.35, w: b.width / 2, tall: 0.65, harm: true, look: `mg:${el.id}:lowring`, ...thrown(b) }); b.jumpAt(s - 0.35); s += gap * 0.9; }
      if (curl) { b.add("bar", s, 0, 0.95, { ds: 0.3, w: b.width / 2, tall: 0.8, harm: true, look: `mg:${el.id}:highring` }); b.curlAt(s - Math.max(6, b.v * 0.45), s + 1.2); }
      else { b.add("wall", s, 0, 0, { ds: 0.35, w: b.width / 2, tall: 0.65, harm: true, look: `mg:${el.id}:lowring`, ...thrown(b) }); b.jumpAt(s - 0.35); }
      return last;
    }
    case "orb": {
      const u = b.rng.pick(lanesOf(b));
      const roll = 0.45, meet = s - (70 * roll) / (1 + roll);
      b.add("roller", s, u, 0, { ds: 0.6, w: 0.75, tall: 1.3, roll, harm: true, look });
      const safe = lanesOf(b).filter((x) => Math.abs(x - u) > 1.8).sort((x, y) => Math.abs(x - last) - Math.abs(y - last))[0] ?? -u;
      b.steerTo(meet - lead, safe, meet + 1.2); return safe;
    }
    case "wave": case "bolt": {
      const amp = Math.min(half - 0.6, 1.6 + b.r.d * 2), ph = b.rng.next() * Math.PI * 2, at = Math.sin(ph) * amp;
      b.add("laser", s, 0, 0, { ds: 0.4, w: fid === "wave" ? 1.1 : 0.6, tall: fid === "wave" ? 1.2 : 1.6, amp, ph, freq: fid === "bolt" ? 0.2 : 0.12, harm: true, look });
      const sides = [-half, half].filter((x) => Math.abs(x - at) > 2.2).sort((x, y) => Math.abs(x - last) - Math.abs(y - last));
      return steer(s, sides[0] ?? (at > 0 ? -half : half));
    }
    case "puddle": case "whirl": {
      const side = last > 0.5 ? -1 : last < -0.5 ? 1 : b.rng.pick([-1, 1]);
      const w = b.width / 4;
      b.add("zone", s + 6, side * (b.width / 2 - w), 0, { ds: 9, w, zone: fid === "whirl" ? "pull" : el.puddle, push: fid === "whirl" ? 2.5 : undefined, look });
      if (fid === "whirl") b.add(el.drop, s + 6, side * (b.width / 2 - 0.6), 0, { ds: 0.6, w: 0.6, tall: 1, harm: true, look, ...thrown(b) });
      const u = -side * (b.width / 2 - 1.3);
      b.steerTo(s - lead, u, s + 16, s - 4); return u;
    }
    case "burst": {
      const free = pickFree(b, last);
      row(b, s, "spike", free, { look, rise: 18, land: Math.max(6, b.R * 0.5), tall: 1 });
      return steer(s, free);
    }
    case "ghost": b.add("clanker", s, 0, 0, { ds: 0.5, w: 0.6, tall: 0.85, look: `mg:${el.id}:ghost`, ballOk: true }); b.jumpAt(s - 0.5); return last;
    case "spiral": {
      const f1 = pickFree(b, last); row(b, s, el.drop, f1, { look, ...thrown(b) }); steer(s, f1);
      const f2 = pickFree(b, f1); row(b, s + gap * 0.8, el.drop, f2, { look, ...thrown(b) }); b.steerTo(s + 1.4, f2, s + gap * 0.8 + 1.2);
      return f2;
    }
    case "cross": {
      for (const sx of [-1, 1]) b.add(el.drop, s, sx * (b.width / 2 - 0.9), 0, { ds: 0.6, w: 0.85, tall: 1, harm: true, look, ...thrown(b) });
      steer(s, 0);
      const side = b.rng.pick([-1, 1]) * Math.min(2.2, half - 0.3);
      b.add(el.drop, s + gap * 0.8, 0, 0, { ds: 0.6, w: 0.9, tall: 1, harm: true, look, ...thrown(b) });
      b.steerTo(s + 1.4, side, s + gap * 0.8 + 1.2); return side;
    }
    case "pillars": {
      const side = (last >= 0 ? 1 : -1) * Math.min(2.3, half - 0.2);
      for (let k = 0; k < 3; k++) b.add("laser", s + k * 5, 0, 0, { ds: 0.4, w: 0.55, tall: 2.2, harm: true, look, ...thrown(b) });
      b.steerTo(s - lead, side, s + 11.5, s - 1); return side;
    }
    case "split": {
      const free = b.rng.pick([-1, 1]) * 2.4;
      row(b, s, el.drop, free, { look, ...thrown(b) });
      return steer(s, Math.max(-half, Math.min(half, free)));
    }
    case "double": {
      const g1 = (last >= 0 ? 1 : -1) * Math.min(1.6, half - 0.8);
      strip(b, s, "laser", g1, { look, ...thrown(b) }); steer(s, g1);
      const g2 = -g1; strip(b, s + gap * 0.9, "laser", g2, { look, ...thrown(b) }); b.steerTo(s + 1.4, g2, s + gap * 0.9 + 1.2);
      return g2;
    }
    default: return last;
  }
}
/** how long a form needs on the track */
const lenOf = (fid: string, gap: number) => (["spiral", "cross", "double", "halo"].includes(fid) ? gap * 1.9 : fid === "puddle" || fid === "whirl" ? gap * 1.3 : gap);

/** Mayamma's stretch: she flies in, casts 5–10 magics, and flies off — a marker over it tells the renderer and the
 * session (her entrance, her music, her laugh) */
export const witchSection: Section = (b) => {
  const r = b.r, N = r.alt ?? r.n;
  const n = Math.max(5, Math.min(10, 5 + Math.floor(r.d * 3) + b.rng.int(0, 1)));
  const gap = Math.max(18, b.R * 1.25);
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    // the stage seed picks the element of the day and varies the forms; early stages skip the trickiest ones
    const pool = FORMS.filter((f) => N > 8 || !["double", "spiral", "halo", "whirl", "ghost"].includes(f.id));
    const f = pool[(b.rng.int(0, pool.length - 1) + i * 3) % pool.length];
    const e = ELEMENTS[(Math.floor(N / 2) * 7 + i * (b.rng.chance(0.5) ? 1 : 4)) % ELEMENTS.length];
    ids.push(`${e.id}:${f.id}`);
  }
  const total = 34 + ids.reduce((x, id) => x + lenOf(id.split(":")[1], gap), 0) + 20;
  const a = b.straight(total);
  let s = a + 30, last = 0;
  for (const id of ids) { last = castMagic(b, id, s, gap, last); s += lenOf(id.split(":")[1], gap); }
  b.add("witch", a + total / 2, 0, 0, { ds: total / 2, look: ids.join(",") });
};

// ---------------------------------------------------------------- the signature obstacle of every stage
export const sigSection: Section = (b, m) => {
  const kind = sigOf(b.r.alt ?? b.r.n);
  const n = m === "sign" ? 3 : 4, gap = Math.max(18, b.R * 1.3);
  const a = b.straight(gap * n + 14);
  let last = 0;
  const look = `sig:${kind}`;
  for (let i = 0; i < n; i++) {
    const s = a + 8 + gap * (i + 0.6);
    const free = pickFree(b, last);
    const steer = (u: number) => { b.steerTo(s - gap * 0.75, u, s + 1.4); last = u; };
    switch (kind) {
      case "popLogs": b.add("roller", s, 0, 0, { ds: 0.45, w: b.width / 2, tall: 0.65, rise: 16, land: Math.max(6, b.R * 0.5), harm: true, look }); b.jumpAt(s - 0.4); break;
      case "risingPillars": case "risingSpikes": row(b, s, kind === "risingSpikes" ? "spike" : "wall", free, { look, rise: 18, land: Math.max(6, b.R * 0.5), tall: 1.6 }); steer(free); break;
      case "sideLogs": case "sideRams": case "giantHammers": case "mallets": case "fireWheels": case "spinningTops": case "sawLines": {
        const amp = Math.min(b.half() - 0.6, 1.6 + b.r.d * 2), ph = b.rng.next() * Math.PI * 2, at = Math.sin(ph) * amp;
        const size = kind === "giantHammers" ? 1.3 : kind === "sideLogs" ? 1.2 : 0.8;
        b.add(kind === "fireWheels" ? "fire" : kind === "sawLines" ? "saw" : "swing", s, 0, kind === "giantHammers" || kind === "mallets" ? 0.5 : 0, { ds: 0.5, w: size, tall: 1.4, amp, ph, freq: kind === "spinningTops" ? 0.18 : 0.11, harm: true, look });
        const sides = [-b.half(), b.half()].filter((x) => Math.abs(x - at) > size + 1.4).sort((x, y) => Math.abs(x - last) - Math.abs(y - last));
        steer(sides[0] ?? (at > 0 ? -b.half() : b.half()));
        break;
      }
      case "fallingBoulders": case "bouncingBoulders": row(b, s, kind === "bouncingBoulders" ? "faller" : "faller", free, { look, drop: 22, land: Math.max(7, b.R * 0.55), tall: 1.2 }); steer(free); break;
      case "fallingLogs": case "fallingTrees": b.add("wall", s, 0, 0, { ds: 0.4, w: b.width / 2, tall: 0.65, drop: 20, land: Math.max(8, b.R * 0.6), harm: true, look }); b.jumpAt(s - 0.4); break;
      case "rollingWheels": case "snowballs": case "bombCarts": {
        const u = b.rng.pick(lanesOf(b)), roll = 0.4, meet = s - (70 * roll) / (1 + roll);
        b.add("roller", s, u, 0, { ds: 0.7, w: 0.85, tall: 2.2, roll, harm: true, look });
        const safe = lanesOf(b).filter((x) => Math.abs(x - u) > 1.9).sort((x, y) => Math.abs(x - last) - Math.abs(y - last))[0] ?? -u;
        b.steerTo(meet - gap * 0.75, safe, meet + 1.4); last = safe; break;
      }
      case "windmills": case "crushers": case "slidingWalls": case "lavaJets": case "geysers": case "stompingBoots": case "flameRings": {
        // blinking across the lanes: the free lane is quiet as you arrive
        const k: ObjKind = kind === "crushers" || kind === "stompingBoots" ? "crusher" : kind === "slidingWalls" ? "door" : kind === "geysers" ? "geyser" : kind === "windmills" ? "laser" : "fire";
        const P = Math.max(18, b.R * 2.4);
        for (const u of lanesOf(b)) b.add(k, s, u, 0, { ds: 0.5, w: 1.0, tall: 1.6, harm: true, look, blink: [P, 0.5, u === free ? 0.5 : 0] });
        steer(free); break;
      }
      case "spinningBars": b.add("bar", s, 0, 0.95, { ds: 0.3, w: b.width / 2, tall: 0.7, harm: true, look }); if (b.moves.curl) b.curlAt(s - Math.max(6, b.v * 0.45), s + 1.2); else { b.objs.pop(); b.add("wall", s, 0, 0, { ds: 0.35, w: b.width / 2, tall: 0.65, harm: true, look }); b.jumpAt(s - 0.35); } break;
      case "tumblingBarrels": b.add("roller", s, 0, 0, { ds: 0.4, w: b.width / 2, tall: 0.65, roll: 0.35, harm: true, look }); b.jumpAt(s - (70 * 0.35) / 1.35 - 0.4); break;
      case "giantFans": { const side = b.rng.pick([-1, 1]); b.add("zone", s, 0, 0, { ds: gap * 0.4, w: b.width / 2, zone: "wind", push: side * 3.5, look }); b.add("spike", s, side * (b.width / 2 - 0.5), 0, { ds: gap * 0.35, w: 0.5, harm: true, look: "edge" }); steer(-side * (b.half() - 0.6)); break; }
      case "bumpers": { for (const sx of [-1, 1]) b.add("bumper", s, sx * (b.half() - 0.2), 0, { ds: 0.6, w: 0.7, push: 9, look }); b.add("spike", s, 0, 0, { ds: 0.6, w: 0.9, harm: true, look }); steer(b.rng.pick([-1.6, 1.6])); break; }
      case "iceSlides": { b.add("zone", s, 0, 0, { ds: gap * 0.45, w: b.width / 2, zone: "ice", look }); row(b, s + gap * 0.3, "spike", free, { look }); b.steerTo(s - gap * 0.75, free, s + gap * 0.3 + 1.2); last = free; break; }
      case "thornHedges": row(b, s, "thorn", free, { look, tall: 0.9 }); steer(free); break;
      default: row(b, s, "spike", free, { look }); steer(free);
    }
  }
};

// ---------------------------------------------------------------- Trick Park
/** kickers, springs through hoops, dash-pad lanes and side springs — nothing to hit, everything to fly off */
export const parkSection: Section = (b) => {
  const n = 4 + b.rng.int(0, 2);
  for (let i = 0; i < n; i++) {
    const kind = (b.rng.int(0, 4) + i) % 5, L = Math.max(46, b.v * 2.9), a = b.straight(L);
    if (kind === 0) { b.add("trickRamp", a + 8, 0, 0, { p: 14, ds: 1.2, w: b.width / 2 }); b.pearlArc(a + 9, 0, 14, 7); }
    else if (kind === 1) {
      const u = b.lane(), p = 17, T = air(p), d = b.v * T;
      b.add("spring", a + 8, u, 0, { p });
      for (const f of [0.3, 0.5, 0.7]) b.add("hoop", a + 8 + d * f, u, Math.max(1, p * f * T - (G / 2) * (f * T) ** 2 + 0.2), { ds: 0.3, w: 1.3 });
      b.steerTo(a + 1, u, a + 8 + d, a + 8);
    } else if (kind === 2) { for (const u of [-2.6, 0, 2.6]) b.add("pad", a + 10, u); b.pearlLine(a + 14, a + L - 4, -1.5, 1.5); }
    else if (kind === 3) {
      const side = b.rng.pick([-1, 1]), e = b.half() - 0.4;
      b.add("sideSpring", a + 8, side * e, 0, { p: -side * 9 }); b.add("sideSpring", a + 28, -side * e, 0, { p: side * 9 });
      b.pearlLine(a + 10, a + 26, side * 1.5, -side * 1.5);
    } else { b.add("trickRamp", a + 8, -1.6, 0, { p: 12, ds: 1.2, w: 1.4 }); b.add("trickRamp", a + 8, 1.6, 0, { p: 15, ds: 1.2, w: 1.4 }); b.pearlArc(a + 9, 1.6, 15, 7); }
  }
};

// ---------------------------------------------------------------- treasure: coins, hearts, powers
const SAFE_POWERS: PowerKind[] = ["shield", "double", "star", "buddy", "mega", "scale", "giant", "shield", "double"];
/** turn some pearls into gold coins, sometimes a heart, and a couple into power orbs */
export function treasure(b: B) {
  const pearls = b.objs.filter((o) => o.k === "pearl" && o.s > 60);
  if (pearls.length < 10) return;
  const pick = () => pearls.splice(b.rng.int(0, pearls.length - 1), 1)[0];
  const nCoins = 6 + b.rng.int(0, 4);
  for (let i = 0; i < nCoins && pearls.length; i++) { const p = pick(); p.k = "item"; p.item = "coin"; p.ds = 0.45; p.w = 0.55; p.tall = 0.8; }
  // a heart: rarer, and more often later on
  if (b.rng.chance(0.35 + Math.min(0.25, b.r.d * 0.15)) && pearls.length) { const p = pick(); p.k = "item"; p.item = "life"; p.ds = 0.5; p.w = 0.6; p.tall = 0.9; }
  for (let i = 0; i < 2 && pearls.length; i++) { const p = pick(); p.k = "power"; p.power = SAFE_POWERS[b.rng.int(0, SAFE_POWERS.length - 1)]; p.h = 0.6; p.ds = 0.5; p.w = 0.7; p.tall = 0.9; }
}
