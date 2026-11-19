// Phases 2–3: the sections for worlds 3–25 — 460 more ideas. They are built from a handful of patterns (rows of lane
// blockers with one way through, full-width hurdles to hop, bars to curl under, things to smash, Clankers with their
// own moves, launchers, platform hops, rails, forks, gates and keys, teleports, carriers, special floors and zones,
// pickups and powers, track shapes, and stage-wide rules, views and chases), each tuned by the idea it teaches. Every
// pattern writes the intents the fairness bot follows, so every stage is still checked before anyone plays it.
import { air, JUMP_V, sp, STEER, type B, type Mode, type Section } from "./gen";
import type { FloorKind, ItemKind, Need, Obj, ObjKind, PowerKind, StageRules, StageView, ZoneKind } from "./types";

type More = Partial<Obj>;
const rows = (b: B, m: Mode, base = 3) => (m === "sign" ? 2 : m === "use" ? base + 1 : base + b.rng.int(0, 1));
const LANE = 2.4;

// ---------------------------------------------------------------- hazards
/** rows of blockers with one way through each (steer). `blink`: every lane blinks; the free one goes dark as you near it */
function lanes(b: B, m: Mode, k: ObjKind, opt: More & { blinkLanes?: boolean } = {}) {
  const { blinkLanes, ...o } = opt;
  const n = rows(b, m), gap = sp(b, m);
  const a = b.straight(gap * n + 12);
  let last = 0;
  const L = -b.width / 2, R = b.width / 2;
  for (let i = 0; i < n; i++) {
    const s = a + gap * (i + 0.7);
    const reach = STEER * ((gap - 2) / b.v) * 0.75;
    const g = Math.max(-b.half() + 0.6, Math.min(b.half() - 0.6, last + (b.rng.next() * 2 - 1) * Math.min(reach, b.width * 0.7)));
    const gw = blinkLanes ? Math.max(2.7, 3.4 - b.r.d * 0.6) : Math.max(2.1, 3.3 - b.r.d * 0.9);
    if (blinkLanes) {
      // lasers across the whole width in strips; the strip over the free gap switches off for the last stretch
      const P = Math.max(18, b.R * 2.4), frac = 0.5;
      for (let u = L + 0.6; u < R - 0.3; u += 1.2) {
        const free = Math.abs(u - g) < gw / 2;
        b.add(k, s, u, 0, { ds: 0.25, w: 0.55, tall: 2.0, harm: true, ...o, blink: [P, frac, free ? frac : 0] });
      }
    } else {
      if (g - gw / 2 - L > 0.4) b.add(k, s, (L + g - gw / 2) / 2, 0, { ds: 0.7, w: (g - gw / 2 - L) / 2, tall: 1, harm: true, ...o });
      if (R - (g + gw / 2) > 0.4) b.add(k, s, (R + g + gw / 2) / 2, 0, { ds: 0.7, w: (R - g - gw / 2) / 2, tall: 1, harm: true, ...o });
    }
    b.steerTo(s - gap * 0.7, g, s + 1.2);
    if (b.knows("C02")) b.pearlLine(s - Math.min(12, gap * 0.6), s + 3, g);
    last = g;
  }
}
/** single blockers dropped in lanes (rocks, icicles, meteors, bombs): shadows first, then they land */
function drops(b: B, m: Mode, k: ObjKind, look: string) {
  const n = rows(b, m), gap = sp(b, m);
  const a = b.straight(gap * n + 12);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const s = a + gap * (i + 0.7);
    const lanes3 = [-LANE, 0, LANE].filter((u) => Math.abs(u) < b.half() + 0.5);
    const free = lanes3.reduce((x, u) => (Math.abs(u - last) < Math.abs(x - last) + b.rng.next() * 2 ? u : x), lanes3[0]);
    for (const u of lanes3) if (u !== free) b.add(k, s, u, 0, { ds: 0.7, w: 0.85, tall: 1.0, drop: Math.max(16, b.R * 1.1), harm: true, look });
    b.steerTo(s - gap * 0.7, free, s + 1.2);
    last = free;
  }
}
/** full-width low things to hop (logs, hurdles, rolling barrels…) */
function hurdles(b: B, m: Mode, k: ObjKind, o: More = {}) {
  const n = rows(b, m), gap = sp(b, m) * 1.05;
  const a = b.straight(gap * n + 12);
  for (let i = 0; i < n; i++) {
    const s = a + gap * (i + 0.65);
    const ob = b.add(k, s, 0, 0, { ds: 0.4, w: b.width / 2, tall: 0.65, harm: true, ...o });
    // rolling things meet you sooner: jump at the meeting point
    const meet = ob.roll ? s - (70 * ob.roll) / (1 + ob.roll) : s;
    b.jumpAt(meet - 0.4);
    if (i === 0 && m !== "mix") b.pearlArc(meet - b.v * air(JUMP_V) * 0.42, 0, JUMP_V, 5);
  }
}
/** a full-width bar overhead: curl (or slide) under it */
function bars(b: B, m: Mode, k: ObjKind, o: More = {}) {
  if (!b.moves.curl) { hurdles(b, m, "wall", { look: o.look }); return; }
  const n = rows(b, m), gap = sp(b, m) * 1.05;
  const a = b.straight(gap * n + 12);
  for (let i = 0; i < n; i++) {
    const s = a + gap * (i + 0.65);
    b.add(k, s, 0, 0.95, { ds: 0.3, w: b.width / 2, tall: 0.7, harm: true, ...o });
    b.curlAt(s - Math.max(6, b.v * 0.45), s + 1.2);
  }
}
/** a full-width wall of things the ball smashes (curl through) */
function smash(b: B, m: Mode, k: ObjKind, o: More = {}) {
  if (!b.moves.curl) { lanes(b, m, k, o); return; }
  const n = rows(b, m), gap = sp(b, m);
  const a = b.straight(gap * n + 12);
  for (let i = 0; i < n; i++) {
    const s = a + gap * (i + 0.7);
    for (let u = -b.width / 2 + 0.9; u < b.width / 2 - 0.4; u += 1.8) b.add(k, s, u, 0, { ds: 0.55, w: 0.85, tall: 1.1, ballOk: true, harm: true, ...o });
    b.curlAt(s - Math.max(6, b.v * 0.45), s + 1.5);
    b.pearlLine(s + 2, s + 10, 0);
  }
}
/** something that sweeps across the track: be on the other side when you pass */
function sweepers(b: B, m: Mode, k: ObjKind, opt: More & { size?: number } = {}) {
  const { size, ...o } = opt;
  const n = rows(b, m), gap = sp(b, m) * 1.1;
  const a = b.straight(gap * n + 12);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const s = a + gap * (i + 0.7);
    const amp = Math.min(b.half() - 0.6, 1.4 + b.r.d * 2.2), ph = b.rng.next() * Math.PI * 2;
    const w = size ?? 0.7;
    b.add(k, s, 0, o.h ?? 0, { ds: 0.5, w, tall: 1.0, amp, ph, freq: o.freq ?? 0.12, harm: true, ...o });
    // where it will be as you pass: take the clear side nearest where you already are
    const at = Math.sin(ph) * amp;
    const sides = [-b.half(), b.half()].filter((u) => Math.abs(u - at) > w + 1.4).sort((x, y) => Math.abs(x - last) - Math.abs(y - last));
    const u = sides[0] ?? (at > 0 ? -b.half() : b.half());
    b.steerTo(s - gap * 0.85, u, s + 1.2);
    last = u;
  }
}
/** a hazard that is only on part of the time (by your distance to it): pass while it is off */
function timed(b: B, m: Mode, k: ObjKind, o: More = {}) { lanes(b, m, k, { ...o, blinkLanes: true }); }

// ---------------------------------------------------------------- Clankers
type BotStyle = "sweep" | "hop" | "fly" | "block" | "stack" | "roll" | "drop" | "blink" | "mirror" | "swarm";
function clankers(b: B, m: Mode, look: string, style: BotStyle) {
  const n = rows(b, m), gap = sp(b, m) * 1.05;
  const a = b.straight(gap * n + 12);
  for (let i = 0; i < n; i++) {
    const s = a + gap * (i + 0.7);
    if (style === "sweep" || style === "blink") {
      const amp = Math.min(b.half() - 0.6, 1.6 + b.r.d * 2.2), ph = b.rng.next() * Math.PI * 2;
      b.add("clanker", s, 0, 0, { ds: 0.5, w: 0.65, tall: 1.0, amp, ph, freq: 0.12, look });
      const at = style === "blink" ? (Math.sin(ph) > 0 ? 1 : -1) * amp : Math.sin(ph) * amp;
      b.steerTo(s - gap * 0.6, at > 0 ? -b.half() : b.half(), s + 1.2);
    } else if (style === "hop") {
      const u = b.lane();
      b.add("hopper", s, u, 0, { ds: 0.5, w: 0.6, tall: 1.0, look, ph: b.rng.next() * 3 });
      b.steerTo(s - gap * 0.6, u > 0 ? -b.half() + 0.4 : b.half() - 0.4, s + 1.2);
    } else if (style === "fly") {
      const u = b.lane();
      b.add("drone", s, u, 0.85, { ds: 0.5, w: 0.7, tall: 0.7, look, bob: [0.5, 0.2, b.rng.next() * 3], ballOk: true });
      b.steerTo(s - gap * 0.6, u > 0 ? -b.half() + 0.3 : b.half() - 0.3, s + 1.2);
    } else if (style === "block") {
      // a big one across the middle: go round, or (ball) bowl it over
      b.add("clanker", s, 0, 0, { ds: 0.7, w: 1.2, tall: 1.4, look, stomp: false });
      const side = b.rng.pick([-1, 1]);
      b.steerTo(s - gap * 0.6, side * b.half(), s + 1.2);
    } else if (style === "stack") {
      // a totem stack: hop over it
      b.add("clanker", s, 0, 0, { ds: 0.5, w: b.width / 2, tall: 0.62, look, stomp: true });
      b.jumpAt(s - 0.5);
    } else if (style === "roll") {
      b.add("clanker", s, 0, 0, { ds: 0.5, w: b.width / 2, tall: 0.62, look, roll: 0.4 });
      b.jumpAt(s - (70 * 0.4) / 1.4 - 0.5);
    } else if (style === "drop") {
      drops(b, "sign", "clanker", look); return;
    } else if (style === "mirror") {
      // it copies your steering: it can never block the far side of a split
      b.add("clanker", s, 0, 0, { ds: 0.5, w: 0.65, tall: 1.0, look: "E16" });
      b.jumpAt(s - 0.5);
    } else {
      // a swarm: small bots on two lanes, the third is free
      const free = b.rng.pick([-LANE, 0, LANE]);
      for (const u of [-LANE, 0, LANE]) if (u !== free) for (let k = 0; k < 3; k++) b.add("drone", s + k * 1.4, u + (k - 1) * 0.4, 0.9 + k * 0.3, { ds: 0.3, w: 0.35, tall: 0.4, look });
      b.steerTo(s - gap * 0.6, free, s + 4);
    }
  }
}

// ---------------------------------------------------------------- launchers, platforms, carriers, teleports
/** a launcher that throws you over a tall wall or across a gap (you only need to run onto it) */
function launcher(b: B, m: Mode, k: ObjKind, o: More & { over?: "wall" | "gap"; up?: number } = {}) {
  const n = m === "sign" ? 1 : 2 + (m === "use" ? 1 : 0);
  const up = o.up ?? 17;
  for (let i = 0; i < n; i++) {
    const L = Math.max(36, b.v * 2.2), a = b.straight(L), at = a + L - 4;
    const u = b.rng.pick([-1, 0, 1]) * Math.min(1.6, b.half() - 0.8);
    b.add(k, at, u, 0, { p: up, launch: o.launch ?? [up, 0, 0], ds: 0.8, w: 0.9, look: o.look });
    b.steerTo(at - 9, u, at + 1, at);
    b.pearlArc(at, u, up, 8);
    const T = air(up), dist = b.v * T;
    if (o.over === "gap") {
      // the gap opens just after the launcher and closes well before you come down
      b.straight(2);
      b.gap(Math.max(3, Math.min(dist * 0.6 - 6, 4 + b.r.d * 6)));
      b.straight(Math.max(14, dist));
    } else {
      b.add("wall", at + dist * 0.5, 0, 0, { ds: 0.4, w: b.width / 2, tall: 2.6, look: o.look });
      b.straight(Math.max(8, dist * 0.7));
    }
  }
}
/** hop across a gap on platforms (lily pads, floating islands, falling or moving ledges) */
function hops(b: B, m: Mode, look: string, o: { fall?: boolean; move?: boolean; h?: number } = {}) {
  const n = m === "sign" ? 2 : 3 + (m === "use" ? 1 : 0);
  b.straight(Math.max(14, b.R * 0.9));
  const pad = o.fall ? Math.max(7.5, b.v * 0.45) : Math.max(9, b.v * 0.62), gapLen = Math.min(5, 3 + b.r.d * 2);
  const s0 = b.s;
  const total = gapLen * (n + 1) + pad * n;
  b.gap(total);
  let s = s0;
  b.jumpAt(s);
  for (let i = 0; i < n; i++) {
    s += gapLen;
    const c = s + pad / 2;
    b.add("platform", c, 0, o.h ?? 0, { ds: pad / 2, w: o.move ? 1.8 : b.width / 2 - 0.2, look: o.fall ? "fall" : look, amp: o.move ? 0.9 : undefined, freq: 0.1, ph: 0 });
    for (let k = 0; k < 3; k++) b.add("pearl", c - pad / 4 + k * (pad / 4), 0, (o.h ?? 0) + 0.9);
    s += pad;
    b.jumpAt(s - (o.fall ? 0.2 : 0));
  }
  b.straight(Math.max(16, b.R));
}
/** something carries you over a gap (elevator, crane hook, balloons, a friend, a kite…) */
function carrier(b: B, m: Mode, look: string, o: { h?: number; len?: number } = {}) {
  const n = m === "sign" ? 1 : 2;
  for (let i = 0; i < n; i++) {
    const S0 = Math.max(24, b.R * 1.4), a = b.straight(S0), at = a + S0 - 6;
    const u = 0, len = o.len ?? Math.max(30, b.v * 2.2);
    b.add("carry", at, u, 0, { ds: 1.2, w: 1.4, carry: len, p: o.h ?? 4, look });
    b.steerTo(at - 8, u, at + 1, at);
    b.straight(4);
    b.gap(len - 16);
    for (let k = 0; k < 6; k++) b.add("pearl", at + 6 + k * ((len - 10) / 6), 0, (o.h ?? 4) + 0.8);
    b.straight(Math.max(16, b.R));
  }
}
/** step into a ring / door / pipe and pop out further on (over a pit) */
function teleport(b: B, m: Mode, look: string) {
  const n = m === "sign" ? 1 : 2;
  for (let i = 0; i < n; i++) {
    const S0 = Math.max(24, b.R * 1.3), a = b.straight(S0), at = a + S0 - 4;
    const u = b.rng.pick([-1, 1]) * Math.min(1.6, b.half() - 0.8);
    const jump = 34;
    b.add("tele", at, u, 0, { ds: 0.4, w: 1.1, p: jump, look });
    b.steerTo(at - 10, u, at + 1, at);
    b.straight(8);
    b.gap(jump - 14);
    b.straight(Math.max(18, b.R));
  }
}

// ---------------------------------------------------------------- rails
type RailStyle = "grind" | "fork" | "hop" | "broken" | "boost" | "junk" | "bots" | "sky" | "weave" | "zip" | "under" | "long";
function rails(b: B, m: Mode, look: string, style: RailStyle) {
  const n = m === "sign" ? 1 : 2;
  for (let i = 0; i < n; i++) {
    const L = Math.max(40, b.v * 3), a = b.straight(14);
    const h = style === "under" || style === "zip" ? 1.45 : 1.0;
    const us = style === "fork" || style === "hop" || style === "weave" ? [-1.8, 1.8] : [b.rng.pick([-1, 0, 1]) * Math.min(1.5, b.half() - 1)];
    const u = us[style === "fork" ? b.rng.int(0, 1) : 0];
    const s0 = a + 14, len = style === "long" ? L * 1.6 : L;
    for (const uu of us) {
      if (style === "broken") {
        b.add("rail", s0 + len * 0.22, uu, h, { ds: len * 0.22, look });
        b.add("rail", s0 + len * 0.75, uu, h, { ds: len * 0.25, look });
      } else b.add("rail", s0 + len / 2, uu, h, { ds: len / 2, look: style === "boost" ? "boost" : look });
    }
    b.steerTo(a + 2, u, s0 + 1, s0);
    b.jumpAt(s0 + 2.5);
    const body = b.straight(len + 4);
    if (style === "sky") { /* the floor under the middle of the rail is open */ }
    if (style === "boost") b.add("zone", s0 + len / 2, u, h, { ds: len / 2, w: 0.6, zone: "fast" });
    if (style === "broken") b.jumpAt(s0 + len * 0.44 - 0.5);
    if (style === "junk" || style === "bots") {
      const at = s0 + len * 0.55;
      b.add(style === "junk" ? "crate" : "clanker", at, u, h, { ds: 0.4, w: 0.45, tall: 0.6, harm: true, look: style === "junk" ? "junk" : "E24" });
      b.jumpAt(at - 0.5);
    }
    for (let k = 0; k < 8; k++) b.add("pearl", s0 + 4 + k * (len / 9), u, h + 0.9);
    void body;
    b.straight(Math.max(10, b.R * 0.6));
  }
}

// ---------------------------------------------------------------- forks, gates, switches
/** two or three ways split by low dividers: one gentle, one risky but rich */
function fork(b: B, m: Mode, ways: 2 | 3, look: string) {
  const len = Math.max(70, b.v * 4.5), a = b.straight(len + 10);
  const W = b.width, lanesU = ways === 2 ? [-W / 4, W / 4] : [-W / 3, 0, W / 3];
  for (let k = 1; k < ways; k++) b.add("divider", a + 5 + len / 2, -W / 2 + (k * W) / ways, 0, { ds: len / 2, w: 0.15, tall: 0.9, look });
  const safe = b.rng.int(0, ways - 1);
  lanesU.forEach((u, k) => {
    if (k === safe) b.pearlLine(a + 10, a + len - 4, u);
    else {
      for (let s = a + 18; s < a + len - 6; s += Math.max(14, b.R * 1.1)) b.add("spike", s, u, 0, { ds: 0.7, w: W / ways / 2 - 0.25, look });
      b.add("bigPearl", a + len - 10, u, 0.9);
    }
  });
  b.steerTo(a - 6, lanesU[safe], a + len + 4, a + 4);
  b.straight(12);
}
/** something to grab first, then the gate it opens (switch tile, key, bells, colour, lanterns, pearls) */
function gated(b: B, m: Mode, need: Need["k"], o: { look?: string; pound?: boolean } = {}) {
  const n = m === "sign" ? 1 : 2;
  for (let i = 0; i < n; i++) {
    const a = b.straight(Math.max(50, b.R * 3));
    const u = b.rng.pick([-1, 0, 1]) * Math.min(1.6, b.half() - 0.8), g = b.rng.int(0, 7);
    if (need === "switch") b.add(o.pound ? "plate" : "switch", a + 12, u, 0, { ds: 0.7, w: 0.9, group: g, look: o.pound ? "pound" : o.look });
    else if (need === "key") b.add("item", a + 12, u, 0.5, { ds: 0.5, w: 0.6, tall: 0.8, item: "key" });
    else if (need === "colour") b.add("switch", a + 12, u, 0, { ds: 0.7, w: 0.9, item: "colour", p: g % 3, look: `colour${g % 3}` });
    else if (need === "bells") for (let k = 0; k < 3; k++) b.add("bell", a + 8 + k * 6, u, 0.6, { ds: 0.4, w: 0.5, tall: 0.7 });
    else if (need === "lanterns") for (let k = 0; k < 3; k++) b.add("lantern", a + 8 + k * 6, u, 0, { ds: 0.4, w: 0.5 });
    const v = need === "bells" ? 3 : need === "key" ? 1 : need === "colour" ? g % 3 : need === "lanterns" ? 3 : 1;
    const nd: Need = { k: need, v, g };
    if (o.pound) {
      // ground pound: jump, then swipe down onto the plate
      b.jumpAt(a + 10.5);
      b.intent({ s: a + 11.2, act: "pound" });
    }
    b.steerTo(a + 2, u, a + 13 + (need === "bells" || need === "lanterns" ? 12 : 0), a + 12);
    b.add("gate", a + Math.max(40, b.R * 2.6), 0, 0, { ds: 0.4, w: b.width / 2, tall: 2.6, need: nd, look: o.look ?? need });
  }
  b.straight(10);
}
/** pickups along pearl lines (letters, shards, chests, fruit, keys…) */
function pickups(b: B, m: Mode, item: ItemKind, count = 3) {
  const len = Math.max(60, b.R * 4), a = b.straight(len);
  const u = b.lane();
  b.pearlLine(a + 6, a + len - 6, u);
  for (let k = 0; k < count; k++) b.add("item", a + 10 + ((len - 20) * (k + 0.5)) / count, u, 0.6, { ds: 0.5, w: 0.6, tall: 0.8, item, p: k });
  b.steerTo(a + 1, u, a + len - 4, a + 6);
  if (m !== "sign") quick(b, 1);
}
/** a power-up, then the stretch it is made for */
function powerRun(b: B, m: Mode, power: PowerKind, then?: (b: B) => void) {
  const a = b.straight(30);
  const u = b.lane();
  b.add("power", a + 14, u, 0.6, { ds: 0.5, w: 0.7, tall: 0.9, power });
  b.steerTo(a + 2, u, a + 15, a + 14);
  if (then) then(b); else quick(b, m === "sign" ? 1 : 2);
}
/** a stretch of special floor (and its zone effect), with something to do on it */
function floorRun(b: B, m: Mode, floor: FloorKind, zone?: ZoneKind, o: { push?: number; len?: number; busy?: number } = {}) {
  const len = o.len ?? Math.max(60, b.R * 4);
  const keep = b.floor;
  b.floor = floor;
  const a = b.straight(len);
  b.floor = keep;
  if (zone) b.add("zone", a + len / 2, 0, 0, { ds: len / 2, w: b.width / 2, zone, push: o.push });
  b.pearlLine(a + 8, a + len - 8, b.lane());
  const busy = o.busy ?? (m === "sign" ? 0 : 1);
  if (busy) placeQuick(b, a + 18, a + len - 12, busy);
}
/** quick hazards on a fresh straight */
function quick(b: B, n: number) {
  const L = Math.max(16, b.R * 1.05);
  const a = b.straight(L * n + 8);
  placeQuick(b, a + 4, a + L * n + 4, n);
}
function placeQuick(b: B, s0: number, s1: number, n: number) {
  const L = Math.max(16, b.R * 1.05);
  for (let k = 0; k < n; k++) {
    const s = s0 + ((s1 - s0) * (k + 0.75)) / n;
    const kind = b.quickKind(); if (!kind) return;
    b.hazardAt(kind, s, Math.min(L, (s1 - s0) / n));
  }
}
/** a zone over a stretch (wind, belts, pull, water, lava…) */
function zoneRun(b: B, m: Mode, zone: ZoneKind, o: { push?: number; floor?: FloorKind; len?: number; side?: number; w?: number; blink?: [number, number, number]; busy?: number } = {}) {
  const len = o.len ?? Math.max(60, b.R * 4);
  const keep = b.floor;
  if (o.floor) b.floor = o.floor;
  const a = b.straight(len);
  b.floor = keep;
  const side = o.side ?? 0, w = o.w ?? b.width / 2;
  b.add("zone", a + len / 2, side * (b.width / 2 - w), 0, { ds: len / 2, w, zone, push: o.push, blink: o.blink });
  if (side) b.steerTo(a - Math.max(16, b.R), -side * (b.width / 2 - 1.2), a + len, a - 2);
  b.pearlLine(a + 6, a + len - 6, side ? -side * (b.width / 2 - 1.4) : b.lane());
  if (o.busy ?? (m === "sign" ? 0 : 1)) placeQuick(b, a + 16, a + len - 10, o.busy ?? 1);
}

// ---------------------------------------------------------------- track shapes
type Shape = "sbend" | "hairpin" | "doubleLoop" | "corkscrew" | "halfpipe" | "quarter" | "drop" | "wallRun" | "ceiling" | "tube" | "spiralDown" | "spiralUp" | "beam" | "plaza" | "dips" | "skiJump" | "band" | "broken" | "drum" | "switchbacks" | "stacked" | "wallClimb" | "loopChain" | "narrow" | "slide";
function shape(b: B, m: Mode, k: Shape) {
  const r = b.rng;
  switch (k) {
    case "sbend": for (let i = 0; i < 4; i++) { const a = b.seg(26, { yaw: (i % 2 ? -1 : 1) * 0.55, tag: "bank" }); b.pearlLine(a + 3, a + 23, (i % 2 ? 1 : -1) * 1.4); } break;
    case "hairpin": { const a = b.seg(70, { yaw: (r.chance(0.5) ? 1 : -1) * Math.PI * 0.9, tag: "bank", fence: "metal" }); b.pearlLine(a + 6, a + 64, 0); b.straight(20); break; }
    case "doubleLoop": { b.straight(20); b.add("pad", b.s - 8, 0); const l1 = b.loop(8); b.straight(4); const l2 = b.loop(9); for (const l of [l1, l2]) for (let k2 = 0; k2 < 8; k2++) b.add("pearl", l + 6 + k2 * 5, 0, 0.9); b.straight(20); break; }
    case "loopChain": { b.straight(20); for (let i = 0; i < 3; i++) { b.add("pad", b.s - 6, 0); const l = b.loop(8 + i); for (let k2 = 0; k2 < 8; k2++) b.add("pearl", l + 6 + k2 * 5, 0, 0.9); b.straight(12); } break; }
    case "corkscrew": { b.straight(14); const a = b.seg(70, { twist: Math.PI * 2, hold: Math.max(b.v, 16), fence: "none", tag: "spiral" }); b.pearlLine(a + 4, a + 66, 0); b.straight(16); break; }
    case "band": { b.straight(14); const a = b.seg(60, { twist: Math.PI, hold: Math.max(b.v, 16), fence: "none", tag: "spiral" }); b.pearlLine(a + 4, a + 56, 0); b.seg(60, { twist: -Math.PI, hold: Math.max(b.v, 16), fence: "none", tag: "spiral" }); b.straight(14); break; }
    case "halfpipe": { const a = b.straight(80, { width: b.width + 3, tag: "tube", fence: "none" }); for (let i = 0; i < 4; i++) b.add("pearl", a + 10 + i * 16, (i % 2 ? 1 : -1) * (b.width / 2 + 0.6), 1.4); b.pearlLine(a + 6, a + 74, 0); break; }
    case "quarter": { const a = b.straight(30); b.add("trickRamp", a + 18, 0, 0, { p: 15, ds: 1.4, w: b.width / 2 }); b.pearlArc(a + 19, 0, 15, 7); b.straight(Math.max(24, b.v * air(15))); break; }
    case "drop": { b.straight(16); const a = b.seg(18, { pitch: -0.9, hold: b.v * 1.2 }); b.seg(26, { hold: b.v * 1.3 }); b.seg(18, { pitch: 0.9, hold: b.v * 1.2 }); b.pearlLine(a + 2, a + 60, 0); b.straight(20); break; }
    case "wallRun": { b.straight(14); const side = r.chance(0.5) ? 1 : -1; const a = b.seg(20, { twist: side * Math.PI / 2, hold: Math.max(b.v, 18), tag: "wall", fence: "none" }); b.seg(40, { hold: Math.max(b.v, 18), tag: "wall", fence: "none" }); b.seg(20, { twist: -side * Math.PI / 2, hold: Math.max(b.v, 18), tag: "wall", fence: "none" }); b.pearlLine(a + 4, a + 76, 0); b.straight(16); break; }
    case "ceiling": { b.straight(14); const a = b.seg(30, { twist: Math.PI, hold: Math.max(b.v, 18), tag: "wall", fence: "none" }); b.seg(40, { hold: Math.max(b.v, 18), tag: "wall", fence: "none" }); b.seg(30, { twist: -Math.PI, hold: Math.max(b.v, 18), tag: "wall", fence: "none" }); b.pearlLine(a + 6, a + 94, 0); b.straight(16); break; }
    case "tube": { const a = b.straight(90, { tag: "tube", fence: "none", width: b.width + 1 }); b.pearlLine(a + 6, a + 84, 0, 0, 0.9, 2.6); quick(b, 0); break; }
    case "spiralDown": case "spiralUp": {
      // climb (or wind down) a full circle; never down when the track is already low
      const up = k === "spiralUp" || b.elev < 44 ? 1 : -1;
      const turn = Math.PI * 2 * (r.chance(0.5) ? 1 : -1);
      b.seg(12, { pitch: up * 0.12 });
      const a = b.seg(170, { yaw: turn, tag: "bank", fence: "metal" });
      b.seg(12, { pitch: -up * 0.12 });
      b.heading -= turn;
      b.pearlLine(a + 6, a + 164, 0);
      break;
    }
    case "beam": { b.straight(14); const a = b.seg(60, { width: 2.4, fence: "none", tag: "beam", floor: "metal" }); b.pearlLine(a + 4, a + 56, 0); b.straight(14); break; }
    case "narrow": { const keep = b.width; for (let i = 0; i < 3; i++) { b.width = Math.max(3.2, keep - (i + 1) * 1.2); const a = b.straight(26); b.pearlLine(a + 3, a + 23, 0); } b.width = keep; break; }
    case "plaza": { const keep = b.width; b.width = keep + 6; const a = b.straight(90, { fence: "stone" }); b.width = keep; for (let i = 0; i < 5; i++) b.pearlLine(a + 8 + i * 16, a + 18 + i * 16, (i % 2 ? 1 : -1) * 3.5); placeQuick(b, a + 20, a + 80, 2); break; }
    case "dips": for (let i = 0; i < 4; i++) { const a = b.hill(30, 0.28); b.add("pearl", a + 15, 0, 1.4); } break;
    case "skiJump": { b.straight(10); const a = b.seg(50, { pitch: -0.35, hold: b.v * 1.2 }); b.seg(12, { pitch: 0.55 }); b.add("trickRamp", b.s - 4, 0, 0, { p: 16, ds: 1.4, w: b.width / 2 }); b.gap(Math.min(14, 8 + b.r.d * 4)); b.seg(30, { pitch: -0.2 }); b.seg(10, { pitch: 0 }); b.pearlLine(a + 4, a + 46, 0); b.straight(14); break; }
    case "broken": for (let i = 0; i < 3; i++) { b.straight(Math.max(14, b.R)); const s = b.gap(Math.min(6, 3 + b.r.d * 3)); b.jumpAt(s); b.pearlArc(s - 3, 0, JUMP_V, 5); } b.straight(12); break;
    case "drum": { b.straight(14); const a = b.seg(50, { twist: Math.PI * 2, hold: Math.max(b.v, 16), tag: "spiral", fence: "none" }); b.pearlLine(a + 4, a + 46, 0); placeQuick(b, a + 46, a + 50, 0); b.straight(14); break; }
    case "switchbacks": for (let i = 0; i < 3; i++) { const a = b.seg(44, { yaw: (i % 2 ? -1 : 1) * Math.PI * 0.75, pitch: 0, tag: "bank" }); b.slope(40, -1, 0.12); b.pearlLine(a + 4, a + 40, 0); } break;
    case "stacked": { const a = b.straight(70); b.add("platform", a + 35, 0, 3.2, { ds: 30, w: b.width / 2 - 0.4, look: "deck" }); b.add("ramp", a + 4, 0, 3.2, { ds: 3, w: b.width / 2 - 0.4, look: "ramp" }); b.pearlLine(a + 10, a + 62, 0, 0, 4.1); b.pearlLine(a + 10, a + 62, 0, 0, 0.9, 5); break; }
    case "wallClimb": { b.straight(16); b.add("pad", b.s - 8, 0); const a = b.seg(16, { pitch: 1.2, hold: Math.max(b.v * 1.2, 20), tag: "wall" }); b.seg(26, { hold: Math.max(b.v * 1.2, 20), tag: "wall" }); b.seg(16, { pitch: -1.2, hold: Math.max(b.v, 18) }); b.pearlLine(a + 2, a + 56, 0); b.straight(16); break; }
    case "slide": { const a = b.straight(80); for (let i = 0; i < 3; i++) b.add("platform", a + 14 + i * 22, 0, 0, { ds: 8, w: 1.6, amp: 1.4, freq: 0.08, ph: i, look: "slide" }); b.pearlLine(a + 6, a + 74, 0); break; }
  }
}

// ---------------------------------------------------------------- stage-wide things (rules, views, chases)
function rules(b: B, set: StageRules) { Object.assign(b.rules, set); }
function view(b: B, set: StageView) { Object.assign(b.view, set); }
function cam(b: B, mode: Obj["cam"], len = 70) { const a = b.straight(len); b.add("cam", a + len / 2, 0, 0, { ds: len / 2, cam: mode }); b.pearlLine(a + 6, a + len - 6, b.lane()); return a; }
function chase(b: B, kind: string, gapM = 32, speed = 0.86) { if (!b.chase) b.chase = { kind, gap: gapM, speed, from: 50, to: 1e9 }; }
function race(b: B, kind: "ghost" | "rival" | "train", lead = 18, speed = 0.9) { b.rules.race = kind; b.rival = { kind, lead, speed }; }
function friend(b: B, look: string, pace = 0.95) { const a = b.straight(20); b.add("friend", a + 30, 1.8, 0, { pace, look, harm: false }); }

// ---------------------------------------------------------------- tricks
function trickRamps(b: B, m: Mode, n = 2, look?: string) {
  for (let i = 0; i < (m === "sign" ? 1 : n); i++) { const a = b.straight(Math.max(40, b.v * 2.6)); b.add("trickRamp", a + 8, 0, 0, { p: 14, ds: 1.2, w: 2.2, look }); b.pearlArc(a + 9, 0, 14, 6); }
}
function hoops(b: B, m: Mode, h = 2.2, n = 4) {
  const a = b.straight(Math.max(60, b.v * 3.5));
  for (let i = 0; i < (m === "sign" ? 3 : n); i++) b.add("hoop", a + 14 + i * 12, (i % 2 ? 1 : -1) * 1.2, h, { ds: 0.3, w: 1.2 });
  b.add("spring", a + 8, 0, 0, { p: 13 });
  b.steerTo(a + 2, 0, a + 9, a + 8);
}

// ---------------------------------------------------------------- the 460 ideas
const S: Record<string, Section> = {
  // ===== Moves
  M05: (b, m) => { launcher(b, m, "spring", { up: 15, look: "pop" }); },
  M08: (b, m) => gated(b, m, "switch", { pound: true, look: "pound" }),
  M09: (b, m) => bars(b, m, "bar", { look: "lowbar" }),
  M10: (b, m) => { for (let i = 0; i < (m === "sign" ? 1 : 2); i++) { const a = b.seg(60, { yaw: (i % 2 ? -1 : 1) * Math.PI * 0.7, tag: "bank", fence: "metal" }); b.pearlLine(a + 4, a + 56, (i % 2 ? 1 : -1) * 1.6); b.straight(16); } },
  M11: (b, m) => { const a = b.straight(60); b.gap(26); for (let k = 0; k < (m === "sign" ? 2 : 3); k++) b.add("balloon", a + 66 + k * 8, 0, 2.2 + k * 0.6, { ds: 0.5, w: 0.6, tall: 0.8, target: true, p: 12 }); b.intent({ s: a + 58, act: "jump" }); for (let k = 0; k < 3; k++) b.intent({ s: a + 60 + k * 8, act: "tap" }); b.straight(30); },
  M12: (b, m) => shape(b, m, "wallClimb"),
  M13: (b, m) => { for (let i = 0; i < (m === "sign" ? 1 : 2); i++) { b.straight(Math.max(16, b.R)); const s = b.gap(Math.min(13, 9 + b.r.d * 3)); b.jumpAt(s); b.intent({ s: s + 3, act: "tap" }); b.pearlLine(s, s + 12, 0, 0, 1.6, 3); } b.straight(16); },
  M14: (b, m) => sweepers(b, m, "roller", { look: "flick", freq: 0.2 }),
  M15: (b, m) => hops(b, m, "brake", { fall: false }),
  M16: (b, m) => { for (let i = 0; i < 2; i++) { b.straight(16); const s = b.gap(4); b.jumpAt(s); b.add("platform", s + 10, 0, 1.0, { ds: 6, w: b.width / 2, look: "ledge" }); b.straight(6); } b.straight(16); void m; },
  M17: (b, m) => launcher(b, m, "pole", { over: "gap", up: 14, launch: [14, 1.5, 0], look: "pole" }),
  M18: (b, m) => { const a = b.slope(110, -1, 0.2); b.add("zone", a + 55, 0, 0, { ds: 55, w: b.width / 2, zone: "ice" }); b.pearlLine(a + 8, a + 100, 0, 0); quick(b, m === "sign" ? 0 : 1); },
  M19: (b, m) => smash(b, m, "crate", { look: "whip" }),
  M20: (b, m) => hurdles(b, m, "roller", { look: "guard" }),
  M21: (b, m) => zoneRun(b, m, "bounce", { floor: "metal" }),
  M22: (b, m) => shape(b, m, "sbend"),
  M23: (b, m) => { const p0 = b.straight(16); b.add("pad", p0 + 10, 0); b.steerTo(p0 - 8, 0, p0 + 11, p0 + 10); zoneRun(b, m, "water", { floor: "water", len: Math.min(50, b.v * 2.4), busy: 0 }); },
  M24: (b, m) => shape(b, m, "wallRun"),
  M25: (b, m) => { shape(b, m, "broken"); },
  // ===== Speed
  S05: (b) => { friend(b, "fast", 1.12); const a = b.straight(80); b.add("zone", a + 40, 0, 0, { ds: 40, w: 1.2, zone: "fast" }); b.pearlLine(a + 6, a + 74, 0); },
  S06: (b, m) => { const p0 = b.straight(20); b.add("pad", p0 + 12, 0); b.steerTo(p0, 0, p0 + 13, p0 + 12); const a = b.straight(30); b.add("gate", a + 26, 0, 0, { ds: 0.4, w: b.width / 2, tall: 2.6, need: { k: "speedMin", v: b.v * 1.2 }, look: "speed" }); void m; },
  S07: (b, m) => hoops(b, m, 1.0, 5),
  S08: (b, m) => zoneRun(b, m, "fast", { floor: "neon", w: 1.4, busy: 1 }),
  S09: (b, m) => zoneRun(b, m, "slow", { floor: "sand", busy: 1 }),
  S10: (b, m) => { launcher(b, m, "spring", { up: 15, look: "land" }); },
  S11: (b, m) => { const a = b.straight(90); b.pearlLine(a + 4, a + 86, 0, 0, 0.9, 1.8); b.add("item", a + 20, 0, 0.6, { item: "fruit", ds: 0.5, w: 0.6, tall: 0.8 }); quick(b, m === "sign" ? 1 : 2); },
  S12: (b, m) => launcher(b, m, "cannon", { over: "gap", up: 16, launch: [16, 2, 0], look: "sling" }),
  S13: (b, m) => zoneRun(b, m, "fast", { busy: 2 }),
  S14: (b, m) => zoneRun(b, m, "headwind", { busy: 1 }),
  S15: (b, m) => { const a = b.straight(70); b.add("zone", a + 35, 0, 0, { ds: 25, w: b.width / 2, zone: "slow" }); b.add("gate", a + 60, 0, 0, { ds: 0.4, w: b.width / 2, tall: 2.6, need: { k: "speedMax", v: b.v * 0.95 }, look: "radar" }); void m; },
  S16: (b, m) => S.M10(b, m),
  S17: (b) => { const a = b.straight(70); for (let i = 0; i < 3; i++) b.add("pad", a + 10 + i * 18, 0, 0); b.steerTo(a, 0, a + 50, a + 10); b.pearlLine(a + 12, a + 66, 0); },
  S18: (b, m) => { S.S11(b, m); },
  S19: (b, m) => { const p0 = b.straight(16); b.add("pad", p0 + 8, 0); b.steerTo(p0 - 6, 0, p0 + 15, p0 + 8); b.add("trickRamp", b.s - 1, 0, 0, { p: 13, ds: 1.2, w: b.width / 2, launch: [13, 2, 0] }); b.gap(Math.min(16, 10 + b.r.d * 4)); b.straight(24); void m; },
  S20: (b, m) => shape(b, m, "drop"),
  S21: (b) => rules(b, { splits: true }),
  S22: (b, m) => { const a = b.straight(70); b.add("zone", a + 35, 0, 0, { ds: 35, w: b.width / 2, zone: "lowg" }); b.add("spring", a + 10, 0, 0, { p: 14 }); b.steerTo(a, 0, a + 11, a + 10); b.pearlArc(a + 10, 0, 14, 10); void m; },
  S23: (b, m) => { b.add("zone", b.s + 40, 0, 0, { ds: 40, w: b.width / 2, zone: "slow" }); hops(b, m, "careful"); },
  S24: (b, m) => launcher(b, m, "cannon", { up: 12, launch: [12, 2.5, 0], look: "band" }),
  S25: (b, m) => { const p0 = b.straight(20); b.add("pad", p0 + 12, 0); b.steerTo(p0, 0, p0 + 13, p0 + 12); clankers(b, m, "E01", "sweep"); },
  // ===== Loops & shapes
  L04: (b, m) => shape(b, m, "sbend"), L05: (b, m) => shape(b, m, "hairpin"), L08: (b, m) => shape(b, m, "doubleLoop"), L09: (b, m) => shape(b, m, "corkscrew"),
  L10: (b, m) => shape(b, m, "halfpipe"), L11: (b, m) => shape(b, m, "quarter"), L12: (b, m) => shape(b, m, "drop"), L13: (b, m) => shape(b, m, "wallRun"),
  L14: (b, m) => shape(b, m, "ceiling"), L15: (b, m) => shape(b, m, "tube"), L16: (b, m) => shape(b, m, "spiralDown"), L17: (b, m) => shape(b, m, "spiralUp"),
  L18: (b, m) => shape(b, m, "beam"), L19: (b, m) => shape(b, m, "plaza"), L20: (b, m) => shape(b, m, "dips"), L21: (b, m) => shape(b, m, "skiJump"),
  L22: (b, m) => shape(b, m, "band"), L23: (b, m) => shape(b, m, "broken"), L24: (b, m) => shape(b, m, "slide"), L25: (b, m) => shape(b, m, "drum"),
  L26: (b, m) => shape(b, m, "switchbacks"), L27: (b, m) => shape(b, m, "stacked"), L28: (b, m) => shape(b, m, "wallClimb"), L30: (b, m) => shape(b, m, "loopChain"),
  // ===== Rails
  R01: (b, m) => rails(b, m, "rail", "grind"), R02: (b, m) => rails(b, m, "rail", "hop"), R03: (b, m) => rails(b, m, "rail", "fork"), R04: (b, m) => rails(b, m, "vine", "grind"),
  R05: (b, m) => rails(b, m, "light", "long"), R06: (b, m) => rails(b, m, "rail", "broken"), R07: (b, m) => rails(b, m, "wobble", "long"), R08: (b, m) => rails(b, m, "rail", "boost"),
  R09: (b, m) => rails(b, m, "zip", "zip"), R10: (b, m) => { shape(b, m, "spiralDown"); }, R11: (b, m) => { rails(b, m, "rail", "grind"); shape(b, m, "doubleLoop"); },
  R12: (b, m) => rails(b, m, "rail", "junk"), R13: (b, m) => rails(b, m, "rail", "bots"), R14: (b, m) => { rails(b, m, "rail", "long"); },
  R15: (b, m) => rails(b, m, "pipe", "long"), R16: (b, m) => rails(b, m, "rail", "under"), R17: (b, m) => { race(b, "rival", 16, 0.9); rails(b, m, "rail", "long"); },
  R18: (b, m) => rails(b, m, "sky", "broken"), R19: (b, m) => rails(b, m, "coaster", "long"), R20: (b, m) => rails(b, m, "rail", "weave"),
  // ===== Air
  A03: (b, m) => launcher(b, m, "spring", { up: 15, look: "moss" }), A04: (b, m) => launcher(b, m, "cannon", { over: "gap", up: 17, launch: [17, 1.5, 0], look: "cannon" }),
  A05: (b, m) => zoneRun(b, m, "updraft", { len: 30, busy: 0 }), A06: (b, m) => carrier(b, m, "leaf", { h: 3 }), A07: (b, m) => launcher(b, m, "spring", { up: 16, look: "balloon" }),
  A08: (b, m) => carrier(b, m, "bubble", { h: 5 }), A09: (b, m) => hoops(b, m, 3, 6), A10: (b, m) => zoneRun(b, m, "updraft", { len: 50, busy: 0 }),
  A11: (b, m) => { for (let i = 0; i < (m === "sign" ? 1 : 2); i++) { b.straight(Math.max(18, b.R)); const s = b.gap(Math.min(b.moves.double ? 11 : 8, 7 + b.r.d * 3)); b.jumpAt(s, b.moves.double ? "double" : "jump"); b.pearlArc(s - 4, 0, JUMP_V, 6); } b.straight(14); },
  A12: (b, m) => hops(b, m, "island", { h: 0 }), A13: (b, m) => hops(b, m, "crumble", { fall: true }), A14: (b, m) => hops(b, m, "mover", { move: true }),
  A15: (b, m) => launcher(b, m, "spring", { up: 16, look: "cloud" }), A16: (b, m) => carrier(b, m, "kite", { h: 6, len: 50 }), A17: (b, m) => { view(b, { dream: false }); launcher(b, m, "spring", { up: 19, look: "big" }); },
  A18: (b, m) => { shape(b, m, "drop"); hoops(b, m, 1.0, 3); }, A19: (b, m) => launcher(b, m, "cannon", { up: 13, launch: [13, 2.5, 0], look: "barrel" }),
  A20: (b, m) => launcher(b, m, "spring", { up: 18, look: "shroom" }), A21: (b, m) => carrier(b, m, "glider", { h: 5, len: 60 }), A22: (b, m) => launcher(b, m, "geyser", { up: 17, look: "geyser" }),
  A23: (b, m) => { for (let i = 0; i < 3; i++) launcher(b, "sign", "spring", { up: 15, look: "chain" }); void m; }, A24: (b, m) => gated(b, m, "bells", { look: "bells" }),
  A25: (b, m) => { b.gravity = 0.55; S.A11(b, m); },
  // ===== Paths
  P02: (b, m) => { smash(b, "sign", "crate", { look: "secret" }); fork(b, m, 2, "secret"); }, P03: (b, m) => fork(b, m, 2, "risky"), P04: (b, m) => fork(b, m, 2, "pearls"),
  P05: (b, m) => fork(b, m, 2, "sign"), P06: (b, m) => fork(b, m, 3, "three"), P07: (b, m) => { b.straight(14); b.add("pad", b.s - 6, 0); shape(b, m, "stacked"); },
  P08: (b, m) => bars(b, m, "bar", { look: "tunnel" }), P09: (b, m) => fork(b, m, 2, "merge"), P10: (b, m) => shape(b, m, "narrow"), P11: (b, m) => shape(b, m, "plaza"),
  P12: (b, m) => { const a = b.straight(60); b.pearlLine(a + 16, a + 50, b.half() - 0.6); b.add("bigPearl", a + 40, b.half() - 0.6, 0.9); void m; },
  P13: (b, m) => fork(b, m, 2, "again"), P14: (b, m) => gated(b, m, "switch", { look: "path" }), P15: (b, m) => fork(b, m, 2, "mirror"),
  P16: (b, m) => shape(b, m, "stacked"), P17: (b, m) => zoneRun(b, m, "underwater", { floor: "glass", busy: 1 }), P18: (b, m) => { rails(b, m, "sky", "grind"); launcher(b, "sign", "spring", { up: 15 }); },
  P19: (b, m) => fork(b, m, 2, "challenge"), P20: (b, m) => { const a = b.straight(80); b.pearlLine(a + 4, a + 76, 0, 0, 0.5, 2); quick(b, m === "sign" ? 1 : 2); },
  // ===== Hazards
  H05: (b, m) => hurdles(b, m, "roller", { look: "log", roll: 0.35 }), H06: (b, m) => drops(b, m, "faller", "rock"), H07: (b, m) => sweepers(b, m, "swing", { look: "log", size: 1.2, h: 0.6 }),
  H08: (b, m) => timed(b, m, "crusher", { look: "crusher" }), H09: (b, m) => timed(b, m, "laser", { look: "fence" }), H10: (b, m) => lanes(b, m, "fire", { look: "lava", tall: 0.3 }),
  H11: (b, m) => timed(b, m, "fire", { look: "jet" }), H12: (b, m) => drops(b, m, "faller", "icicle"), H13: (b, m) => lanes(b, m, "thorn", { look: "bush", tall: 0.9 }),
  H14: (b, m) => sweepers(b, m, "saw", { look: "gear", size: 0.9 }), H15: (b, m) => zoneRun(b, m, "zap", { side: b.rng.pick([-1, 1]), w: b.width / 4, blink: [20, 0.55, 0], busy: 0 }),
  H16: (b, m) => zoneRun(b, m, "crumble", { floor: "rock", busy: 0 }), H17: (b, m) => lanes(b, m, "bomb", { look: "crate" }), H18: (b, m) => sweepers(b, m, "bar", { look: "spin", size: 1.4, freq: 0.18 }),
  H19: (b, m) => sweepers(b, m, "swing", { look: "hammer", size: 1.3, freq: 0.1 }), H20: (b, m) => timed(b, m, "geyser", { look: "blast", harm: true }), H21: (b, m) => hurdles(b, m, "roller", { look: "barrel", roll: 0.45 }),
  H22: (b, m) => zoneRun(b, m, "wind", { push: 4.5, blink: [30, 0.5, 0], busy: 0 }), H24: (b, m) => sweepers(b, m, "mine", { look: "bubble", h: 0.4, freq: 0.08 }),
  H23: (b, m) => zoneRun(b, m, "wind", { push: 5, busy: 1 }), H25: (b, m) => timed(b, m, "door", { look: "slide" }), H26: (b, m) => timed(b, m, "crusher", { look: "piston" }),
  H27: (b, m) => zoneRun(b, m, "goo", { side: b.rng.pick([-1, 1]), w: b.width / 3, busy: 0 }), H28: (b, m) => drops(b, m, "faller", "bolt"), H29: (b, m) => zoneRun(b, m, "web", { len: 30, w: 1.4, busy: 0 }),
  H30: (b, m) => zoneRun(b, m, "pull", { push: 3, side: b.rng.pick([-1, 1]), w: 0.6, busy: 1 }),
  // ===== Clankers
  E04: (b, m) => clankers(b, m, "E04", "sweep"), E05: (b, m) => clankers(b, m, "E05", "block"), E06: (b, m) => { clankers(b, m, "E06", "block"); hurdles(b, "sign", "roller", { look: "ball", roll: 0.5 }); },
  E07: (b, m) => clankers(b, m, "E07", "hop"), E08: (b, m) => { zoneRun(b, m, "pull", { push: 2.5, side: b.rng.pick([-1, 1]), w: 0.8, busy: 0 }); }, E09: (b, m) => clankers(b, m, "E09", "block"),
  E10: (b, m) => clankers(b, m, "E10", "hop"), E11: (b, m) => { clankers(b, "sign", "E11", "sweep"); zoneRun(b, m, "ice", { busy: 1 }); }, E12: (b, m) => { clankers(b, m, "E12", "sweep"); },
  E13: (b, m) => drops(b, m, "bomb", "gull"), E14: (b, m) => clankers(b, m, "E14", "sweep"), E15: (b, m) => clankers(b, m, "E15", "stack"), E16: (b, m) => clankers(b, m, "E16", "mirror"),
  E17: (b, m) => { view(b, { dark: true }); clankers(b, m, "E17", "sweep"); }, E18: (b, m) => clankers(b, m, "E18", "block"), E19: (b, m) => clankers(b, m, "E19", "hop"), E20: (b, m) => clankers(b, m, "E20", "fly"),
  E21: (b, m) => clankers(b, m, "E21", "stack"), E22: (b, m) => clankers(b, m, "E22", "fly"), E23: (b, m) => timed(b, m, "laser", { look: "eye" }), E24: (b, m) => rails(b, m, "rail", "bots"),
  E25: (b, m) => { zoneRun(b, m, "shrink", { len: 20, busy: 0 }); bars(b, "sign", "bar", { look: "mini", h: 0.7 }); }, E26: (b, m) => clankers(b, m, "E26", "swarm"), E27: (b, m) => clankers(b, m, "E27", "block"),
  E28: (b, m) => { race(b, "rival", 14, 0.92); clankers(b, m, "E28", "sweep"); }, E29: (b, m) => clankers(b, m, "E29", "blink"), E30: (b, m) => clankers(b, m, "E30", "swarm"),
  // ===== Collectibles
  C04: (b) => { const a = b.straight(60); for (let i = 0; i < 16; i++) { const t = (i / 16) * Math.PI * 2; b.add("pearl", a + 30 + Math.cos(t) * 8, Math.sin(t) * 2.2, 0.9 + (Math.cos(t) + 1) * 0.5); } },
  C05: (b) => { const a = b.straight(60); for (let i = 0; i < 3; i++) b.add("bigPearl", a + 14 + i * 16, (i - 1) * 2.2, 0.9); },
  C06: (b, m) => { quick(b, m === "sign" ? 1 : 2); }, C07: (b, m) => { pickups(b, m, "letter", 5); }, C08: (b) => { const a = b.straight(60); for (let i = 0; i < 20; i++) b.add("pearl", a + 6 + i * 2.6, Math.sin(i) * 2.4, 0.9, { drop: 24 }); },
  C09: (b) => { const a = b.straight(60); for (let i = 0; i < 12; i++) b.add("pearl", a + 6 + i * 4, b.half() * (i % 2 ? 1 : -1), 0.9, { amp: 1.5, freq: 0.15, ph: i }); }, C10: (b, m) => pickups(b, m, "chest", 2),
  C11: (b, m) => smash(b, m, "crate", { look: "chest" }), C12: (b, m) => pickups(b, m, "scrap", 3), C13: (b, m) => smash(b, m, "cage", { look: "cage" }), C14: (b, m) => pickups(b, m, "fruit", 2),
  C15: (b, m) => pickups(b, m, "shard", 5), C16: (b, m) => { rules(b, { time: 1 }); pickups(b, m, "time", 3); }, C17: (b) => { const a = b.straight(100); b.pearlLine(a + 4, a + 96, 0, 0, 0.9, 2); },
  C18: (b, m) => pickups(b, m, "mystery", 2), C19: (b, m) => { pickups(b, m, "gold", 1); }, C20: (b, m) => pickups(b, m, "clover", 2),
  // ===== Power-ups
  U02: (b, m) => powerRun(b, m, "shield"), U03: (b, m) => powerRun(b, m, "fire", (bb) => lanes(bb, m, "fire", { look: "lava", tall: 0.3 })), U04: (b, m) => powerRun(b, m, "water", (bb) => zoneRun(bb, m, "underwater", { floor: "glass" })),
  U05: (b, m) => powerRun(b, m, "thunder", (bb) => clankers(bb, m, "E01", "sweep")), U06: (b, m) => powerRun(b, m, "shoes"), U07: (b, m) => powerRun(b, m, "giant", (bb) => smash(bb, m, "crate")),
  U08: (b, m) => powerRun(b, m, "mini", (bb) => bars(bb, m, "bar", { look: "mini" })), U09: (b, m) => powerRun(b, m, "ghost"), U10: (b, m) => powerRun(b, m, "double", (bb) => S.C17(bb, m)),
  U11: (b, m) => powerRun(b, m, "cape", (bb) => S.A11(bb, m)), U12: (b, m) => powerRun(b, m, "rocket", (bb) => shape(bb, m, "broken")), U13: (b, m) => powerRun(b, m, "snowball", (bb) => smash(bb, m, "crate", { look: "snow" })),
  U14: (b, m) => powerRun(b, m, "star"), U15: (b, m) => powerRun(b, m, "slowmo"), U16: (b, m) => powerRun(b, m, "storm"), U17: (b, m) => powerRun(b, m, "scale"),
  U18: (b, m) => powerRun(b, m, "autohop"), U19: (b, m) => { rules(b, { time: 1 }); powerRun(b, m, "time"); }, U20: (b, m) => powerRun(b, m, "buddy", (bb) => S.C09(bb, m)), U21: (b, m) => powerRun(b, m, "board", (bb) => zoneRun(bb, m, "water", { floor: "water", busy: 0 })),
  U22: (b, m) => powerRun(b, m, "skates", (bb) => zoneRun(bb, m, "ice", { floor: "ice" })), U23: (b, m) => powerRun(b, m, "bouncy"), U24: (b, m) => powerRun(b, m, "wings", (bb) => S.A11(bb, m)), U25: (b, m) => powerRun(b, m, "mega"),
  // ===== Terrain
  T02: (b, m) => floorRun(b, m, "stone"), T03: (b, m) => floorRun(b, m, "sand", "slow"), T04: (b, m) => floorRun(b, m, "ice", "ice"), T05: (b, m) => floorRun(b, m, "rock", "mud"),
  T06: (b, m) => floorRun(b, m, "snow"), T07: (b, m) => { b.bridge(70, b.width, "wood"); quick(b, m === "sign" ? 0 : 1); }, T08: (b, m) => floorRun(b, m, "glass", "crumble", { busy: 0 }), T09: (b, m) => floorRun(b, m, "grass", "bounce"),
  T10: (b, m) => floorRun(b, m, "rock", "crumble", { busy: 0 }), T11: (b, m) => floorRun(b, m, "crystal", "fast"), T12: (b, m) => floorRun(b, m, "metal", "belt", { push: 3.5 }), T13: (b, m) => floorRun(b, m, "metal", "fast"),
  T14: (b, m) => floorRun(b, m, "candy", "goo", { busy: 0 }), T15: (b, m) => floorRun(b, m, "rock", "oil", { busy: 0 }), T16: (b, m) => floorRun(b, m, "rock", "hot"), T17: (b, m) => floorRun(b, m, "water", "slow"),
  T18: (b, m) => floorRun(b, m, "cloud", "bounce", { busy: 0 }), T19: (b, m) => { floorRun(b, m, "neon"); timed(b, "sign", "laser", { look: "tile", tall: 0.3 }); }, T20: (b, m) => floorRun(b, m, "metal", "bounce", { busy: 0 }), T21: (b, m) => { floorRun(b, m, "leaves"); shape(b, m, "broken"); },
  T22: (b, m) => floorRun(b, m, "metal"), T23: (b, m) => { b.bridge(60, b.width - 1, "wood"); zoneRun(b, m, "wind", { push: 2, len: 40, busy: 0 }); }, T24: (b, m) => floorRun(b, m, "ice", "crumble", { busy: 0 }), T25: (b, m) => shape(b, m, "ceiling"),
  // ===== Water, weather & nature
  N02: (b, m) => zoneRun(b, m, "fast", { floor: "water", busy: 2 }), N03: (b, m) => { shape(b, m, "dips"); zoneRun(b, m, "fast", { floor: "water", busy: 1 }); }, N04: (b) => chase(b, "tide", 36, 0.84), N05: (b, m) => launcher(b, m, "geyser", { up: 16, look: "geyser" }),
  N06: (b, m) => zoneRun(b, m, "pull", { push: 3, side: b.rng.pick([-1, 1]), w: 1, floor: "water", busy: 0 }), N07: (b, m) => { shape(b, m, "tube"); }, N08: (b, m) => { const p0 = b.straight(16); b.add("pad", p0 + 8, 0); b.steerTo(p0 - 6, 0, p0 + 9, p0 + 8); zoneRun(b, m, "water", { floor: "water", len: 50, busy: 0 }); },
  N09: (b, m) => { view(b, { rain: true }); zoneRun(b, m, "rain", { busy: 1 }); }, N10: (b, m) => { shape(b, m, "tube"); }, N11: (b, m) => zoneRun(b, m, "underwater", { floor: "glass", busy: 1 }), N12: (b, m) => { const a = b.straight(70); for (let i = 0; i < 4; i++) b.add("hoop", a + 10 + i * 15, 0, 0.6, { ds: 0.3, w: 1.6, look: "coral" }); b.pearlLine(a + 6, a + 66, 0); void m; },
  N13: (b, m) => sweepers(b, m, "critter", { look: "fish", h: 1.2, freq: 0.16 }), N14: (b, m) => hops(b, m, "lily"), N15: (b, m) => { zoneRun(b, m, "pull", { push: 3, w: 1.2, busy: 0 }); drops(b, "sign", "faller", "debris"); }, N16: (b) => chase(b, "avalanche", 34, 0.86),
  N17: (b, m) => { view(b, { fog: true }); zoneRun(b, m, "wind", { push: 3, busy: 1 }); }, N18: (b, m) => { view(b, { flash: true }); drops(b, m, "faller", "bolt"); }, N19: (b, m) => drops(b, m, "faller", "meteor"), N20: (b, m) => { b.bridge(70, b.width, "neon"); quick(b, m === "sign" ? 0 : 1); },
  N21: (b, m) => { view(b, { dark: true }); b.bridge(70, b.width, "neon"); quick(b, m === "sign" ? 0 : 1); }, N22: (b) => view(b, { dayToNight: true }), N23: (b, m) => { view(b, { fog: true }); quick(b, m === "sign" ? 1 : 2); }, N24: (b, m) => { view(b, { fog: true }); floorRun(b, m, "leaves"); },
  N25: (b, m) => drops(b, m, "bomb", "lava"),
  // ===== Gadgets
  G01: (b, m) => gated(b, m, "switch", { look: "tile" }), G02: (b, m) => { b.straight(14); b.add("gate", b.s + 30, 0, 0, { ds: 0.4, w: b.width / 2, tall: 2.6, blink: [Math.max(60, b.R * 4), 0.55, 0.62], look: "timed" }); b.straight(40); void m; },
  G03: (b, m) => carrier(b, m, "lift", { h: 4 }), G04: (b, m) => { const a = b.straight(70); for (let i = 0; i < 5; i++) b.add("bumper", a + 10 + i * 12, (i % 2 ? 1 : -1) * (b.half() - 0.6), 0, { ds: 0.6, w: 0.7, push: 9 }); b.pearlLine(a + 6, a + 66, 0); void m; },
  G05: (b, m) => launcher(b, m, "spring", { up: 16, launch: [16, 1, 0], look: "flipper" }), G06: (b, m) => teleport(b, m, "ring"), G07: (b, m) => teleport(b, m, "door"), G08: (b, m) => hops(b, m, "gear", { h: 0.6 }),
  G09: (b, m) => launcher(b, m, "spring", { up: 15, look: "seesaw" }), G10: (b, m) => { b.bridge(50, b.width, "metal"); sweepers(b, m, "bar", { look: "bridge", size: 1.6, freq: 0.06 }); }, G11: (b, m) => gated(b, m, "bells", { look: "draw" }), G12: (b, m) => carrier(b, m, "hook", { h: 4.5 }),
  G13: (b, m) => { shape(b, m, "tube"); }, G14: (b, m) => clankers(b, m, "car", "block"), G15: (b, m) => teleport(b, m, "pipe"), G16: (b, m) => shape(b, m, "wallRun"), G17: (b, m) => shape(b, m, "ceiling"),
  G18: (b, m) => gated(b, m, "switch", { look: "light" }), G19: (b, m) => gated(b, m, "colour", { look: "colour" }), G20: (b, m) => gated(b, m, "key", { look: "key" }), G21: (b) => { b.target = Math.max(b.target, 1); const a = b.straight(60); b.pearlLine(a + 4, a + 56, 0); },
  G22: (b, m) => gated(b, m, "bells", { look: "bells" }), G23: (b, m) => { view(b, { dark: true }); gated(b, m, "lanterns", { look: "lantern" }); }, G24: (b, m) => carrier(b, m, "balloons", { h: 5 }), G25: (b, m) => powerRun(b, m, "slowmo"),
  // ===== Tricks
  X02: (b, m) => trickRamps(b, m, 2), X03: (b, m) => trickRamps(b, m, 2), X04: (b, m) => rails(b, m, "rail", "long"), X05: (b, m) => shape(b, m, "wallRun"), X06: (b, m) => trickRamps(b, m, 2, "flip"), X07: (b, m) => trickRamps(b, m, 3, "spin"),
  X08: (b, m) => launcher(b, m, "spring", { up: 19 }), X09: (b, m) => { lanes(b, m, "spike"); }, X10: (b, m) => S.C17(b, m), X11: (b, m) => trickRamps(b, m, 3), X12: (b, m) => hoops(b, m, 2.4, 5), X13: (b, m) => shape(b, m, "halfpipe"),
  X14: (b, m) => trickRamps(b, m, 2, "show"), X15: (b, m) => { trickRamps(b, m, 1); launcher(b, "sign", "spring", { up: 14 }); }, X16: (b, m) => trickRamps(b, m, 3), X17: (b, m) => trickRamps(b, m, 2), X18: (b, m) => trickRamps(b, m, 2, "signature"),
  X19: (b, m) => { friend(b, "crowd", 0); trickRamps(b, m, 2); }, X20: (b, m) => { shape(b, m, "plaza"); trickRamps(b, m, 2); },
  // ===== Camera & view twists
  V02: (b) => cam(b, "side"), V03: (b) => cam(b, "top"), V04: (b) => cam(b, "front", 60), V05: (b, m) => { cam(b, "birds", 30); shape(b, m, "drop"); }, V06: (b) => cam(b, "slowmo", 40), V07: (b, m) => { cam(b, "tilt", 20); shape(b, m, "sbend"); },
  V08: (b) => cam(b, "wide", 90), V09: (b, m) => { view(b, { dark: true }); shape(b, m, "tube"); }, V10: (b) => view(b, { mirror: true }), V11: (b, m) => shape(b, m, "ceiling"), V12: (b) => cam(b, "eye", 40),
  V13: (b, m) => { view(b, { dark: true }); rules(b, { light: true }); quick(b, m === "sign" ? 1 : 2); }, V14: (b, m) => { view(b, { dark: true }); rules(b, { light: true }); quick(b, m === "sign" ? 1 : 2); }, V15: (b) => view(b, { dark: true, flash: true }),
  V16: (b) => cam(b, "lens", 80), V17: (b) => cam(b, "rear", 60), V18: (b) => cam(b, "drone", 70), V19: (b) => cam(b, "photo", 30), V20: (b) => view(b, { dream: true }),
  // ===== Stage goals & rules
  Q02: (b) => rules(b, { time: 1 }), Q04: (b) => rules(b, { noHit: true }), Q05: (b) => race(b, "ghost", 16, 0.92), Q06: (b) => race(b, "rival", 18, 0.9), Q07: (b, m) => { rules(b, { letters: true }); pickups(b, m, "letter", 5); },
  Q08: (b) => rules(b, { escort: true }), Q09: (b) => { b.rules.minSpeed = b.v * 0.55; }, Q10: (b) => { view(b, { dark: true }); rules(b, { light: true }); }, Q11: (b, m) => { rules(b, { combo: 60 }); trickRamps(b, m, 2); }, Q12: (b) => rules(b, { medals: true }),
  Q13: (b) => rules(b, { noHit: true }), Q14: (b) => rules(b, { noBonk: true }), Q15: (b, m) => { rules(b, { bonkAll: 3 }); clankers(b, m, "E02", "hop"); }, Q16: (b) => rules(b, { survive: 1 }), Q17: (b) => rules(b, { splits: true }),
  Q18: (b, m) => { rules(b, { fade: true }); S.C08(b, m); }, Q19: (b) => rules(b, { softLand: true }), Q20: (b, m) => { view(b, { dark: true }); rules(b, { lanterns: 3 }); gated(b, m, "lanterns"); }, Q21: (b) => cam(b, "front", 80), Q22: (b) => view(b, { mirror: true }),
  Q23: (b, m) => { rules(b, { thief: true }); const a = b.straight(20); b.add("clanker", a + 60, 0, 0, { pace: 0.9, look: "thief", ds: 0.5, w: 0.6, tall: 1 }); quick(b, m === "sign" ? 1 : 2); }, Q24: (b) => rules(b, { egg: true }), Q25: (b) => rules(b, { sprint: 1 }),
  // ===== Chases
  D01: (b, m) => { chase(b, "boulder"); shape(b, m, "dips"); }, D02: (b) => chase(b, "wave"), D03: (b, m) => { chase(b, "fall", 30, 0.86); b.bridge(80, b.width, "wood"); quick(b, m === "sign" ? 0 : 1); }, D04: (b) => chase(b, "tornado"),
  D05: (b) => chase(b, "avalanche"), D06: (b) => chase(b, "lava"), D07: (b) => chase(b, "giant"), D08: (b, m) => carrier(b, m, "whale", { h: 2, len: 60 }), D09: (b) => race(b, "train", 20, 0.9), D10: (b, m) => { chase(b, "tower"); shape(b, m, "drop"); },
  D11: (b, m) => drops(b, m, "faller", "star"), D12: (b, m) => { chase(b, "airship", 34, 0.85); hops(b, m, "deck"); }, D13: (b, m) => carrier(b, m, "rocket", { h: 3, len: 70 }), D14: (b, m) => carrier(b, m, "serpent", { h: 4, len: 70 }), D15: (b, m) => { shape(b, m, "drop"); shape(b, m, "drop"); },
  D16: (b, m) => { chase(b, "cliff"); zoneRun(b, m, "crumble", { busy: 0 }); }, D17: (b, m) => { view(b, { rain: true, flash: true }); drops(b, m, "faller", "bolt"); }, D18: (b) => { for (let i = 0; i < 3; i++) friend(b, "herd", 0.95 + i * 0.03); }, D19: (b) => chase(b, "flood"),
  D20: (b, m) => { b.bridge(80, b.width, "neon"); quick(b, m === "sign" ? 0 : 1); }, D21: (b, m) => { view(b, { lightShow: true }); quick(b, m === "sign" ? 1 : 2); }, D22: (b, m) => { shape(b, m, "dips"); shape(b, m, "loopChain"); }, D23: (b, m) => { floorRun(b, m, "ice", "fast", { len: 120 }); },
  D24: (b) => chase(b, "shadow"), D25: (b, m) => { chase(b, "fortress", 30, 0.88); drops(b, m, "faller", "debris"); },
  // ===== Rhythm
  Y01: (b, m) => S.C17(b, m), Y02: (b, m) => S.S17(b, m), Y03: (b, m) => S.S11(b, m), Y04: (b, m) => hurdles(b, m, "wall", { look: "beat" }), Y05: (b, m) => S.C17(b, m), Y06: (b, m) => zoneRun(b, m, "bounce", { floor: "boards" }),
  Y07: (b, m) => floorRun(b, m, "neon"), Y08: (b, m) => timed(b, m, "laser", { look: "bass" }), Y09: (b, m) => { const a = b.straight(90); b.pearlLine(a + 4, a + 86, 0); void m; }, Y10: (b) => view(b, { tempoUp: true }), Y11: (b) => view(b, { silent: true }),
  Y12: (b) => view(b, { echo: true }), Y13: (b, m) => timed(b, m, "door", { look: "beat" }), Y14: (b) => view(b, { lightShow: true }), Y15: (b, m) => { shape(b, m, "plaza"); view(b, { lightShow: true }); }, Y16: (b, m) => fork(b, m, 2, "remix"),
  Y17: (b, m) => timed(b, m, "laser", { look: "beat" }), Y18: (b, m) => gated(b, m, "bells", { look: "tower" }), Y19: (b, m) => zoneRun(b, m, "wind", { push: 2.5, busy: 1 }), Y20: (b, m) => { view(b, { tempoUp: true }); quick(b, m === "sign" ? 1 : 2); },
  // ===== Friends
  F01: (b) => { rules(b, { escort: false }); friend(b, "momo", 1.0); }, F02: (b, m) => carrier(b, m, "bonbon", { h: 3 }), F03: (b, m) => fork(b, m, 2, "tiki"), F04: (b, m) => carrier(b, m, "pip", { h: 5 }), F05: (b, m) => { b.straight(14); const s = b.bridge(30, b.width, "none"); b.add("friend", s + 15, 0, -0.3, { look: "gloop", harm: false }); void m; },
  F06: (b, m) => gated(b, m, "switch", { look: "zib" }), F07: (b, m) => launcher(b, m, "pole", { over: "gap", up: 14, launch: [14, 1.5, 0], look: "kiko" }), F08: (b) => friend(b, "relay", 1.0), F09: (b, m) => smash(b, m, "cage", { look: "cage" }), F10: (b, m) => { friend(b, "cheer", 0); zoneRun(b, m, "fast", { len: 40, busy: 0 }); },
  F11: (b, m) => carrier(b, m, "turtle", { h: 1, len: 60 }), F12: (b, m) => launcher(b, m, "geyser", { up: 17, over: "gap", look: "dolphin" }), F13: (b, m) => carrier(b, m, "owl", { h: 5, len: 60 }), F14: (b) => { view(b, { dark: true }); friend(b, "firefly", 1.0); }, F15: (b) => { for (const f of ["momo", "kiko", "pip"]) friend(b, f, 1.0); },
};

// ---------------------------------------------------------------- world openers: a showcase of each world
const OPEN: Record<number, Section> = {
  3: (b, m) => { b.bridge(70, b.width, "wood"); S.N12(b, m); }, 4: (b, m) => { floorRun(b, m, "candy", undefined, { busy: 0 }); shape(b, m, "dips"); }, 5: (b, m) => { shape(b, m, "sbend"); S.F02(b, "sign"); },
  6: (b, m) => { floorRun(b, m, "crystal", undefined, { busy: 0 }); shape(b, m, "tube"); }, 7: (b, m) => { floorRun(b, m, "neon", undefined, { busy: 0 }); rails(b, "sign", "light", "grind"); }, 8: (b, m) => { floorRun(b, m, "snow", undefined, { busy: 0 }); shape(b, m, "skiJump"); },
  9: (b, m) => { floorRun(b, m, "cloud", undefined, { busy: 0 }); hops(b, "sign", "island"); }, 10: (b, m) => { floorRun(b, m, "rock", undefined, { busy: 0 }); shape(b, m, "drop"); }, 11: (b, m) => { b.bridge(60, b.width - 1, "wood"); shape(b, m, "sbend"); },
  12: (b, m) => { floorRun(b, m, "sand", undefined, { busy: 0 }); shape(b, m, "dips"); }, 13: (b, m) => { floorRun(b, m, "metal", "belt", { push: 1.5, busy: 0 }); }, 14: (b, m) => { shape(b, m, "dips"); shape(b, m, "doubleLoop"); },
  15: (b, m) => { shape(b, m, "tube"); }, 16: (b, m) => { floorRun(b, m, "leaves", undefined, { busy: 0 }); shape(b, m, "switchbacks"); }, 17: (b, m) => { view(b, { rain: true }); shape(b, m, "sbend"); },
  18: (b, m) => { launcher(b, "sign", "spring", { up: 17, look: "shroom" }); shape(b, m, "dips"); }, 19: (b, m) => { shape(b, m, "spiralUp"); }, 20: (b, m) => { floorRun(b, m, "rainbow", "fast", { busy: 0 }); },
  21: (b, m) => { view(b, { fog: true }); b.bridge(60, b.width - 1, "wood"); quick(b, m === "sign" ? 0 : 1); }, 22: (b, m) => { b.gravity = 0.7; shape(b, m, "ceiling"); }, 23: (b, m) => { floorRun(b, m, "neon", undefined, { busy: 0 }); shape(b, m, "corkscrew"); },
  24: (b, m) => { floorRun(b, m, "stone", undefined, { busy: 0 }); shape(b, m, "switchbacks"); }, 25: (b, m) => { floorRun(b, m, "metal", undefined, { busy: 0 }); shape(b, m, "wallRun"); },
};
for (let w = 3; w <= 25; w++) S[`W${String(w).padStart(2, "0")}`] = OPEN[w];

export const MORE = S;
/** ideas that make sense as a piece of any stage (the Remix Run mixes these too) — not stage-wide rules or views */
export const MIX_MORE = new Set(Object.keys(S).filter((c) => !/^(W|K|Q|V)/.test(c) && !["S21", "N22", "N04", "N16", "D02", "D04", "D05", "D06", "D07", "D09", "D19", "D24", "Y10", "Y11", "Y12", "Y14", "G21", "C06", "F01", "F08", "F14", "F15", "D18"].includes(c)));
