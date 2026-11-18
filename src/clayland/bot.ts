// An autopilot for Puddo: plays the title-screen demo and drives the stage sweep (scripts/clay_sweep.mjs). It runs and
// guns, jumps gaps, walls, hazards and shots, ducks low beams, holds its ground in ambush gates, climbs towers, dives
// shafts, turns back for pumps and cages, climbs to keys, guards the well, throws bombs at hives and heavies and fires
// Super Rain in a crowd. A decent player, not a perfect one.
import { reach } from "./physics";
import type { Input, Sim } from "./sim";
import { T } from "./types";

export interface BotMem { hold: number; wait: number; stuck: number; lastX: number; lastY: number; back: number; climbT: number; seek: number; cdir: number }
export const newBotMem = (): BotMem => ({ hold: 0, wait: 0, stuck: 0, lastX: 0, lastY: 0, back: 0, climbT: 0, seek: 0, cdir: 1 });

const HAZ = new Set<number>([T.SPIKES, T.LAVA, T.POISON]);

/** in a tall stage (or climbing to a key): pick a ledge above in reach and go for it */
function climbToward(s: Sim, m: BotMem, inp: Input, goalX: number, goalY: number) {
  const x = s.x, y = s.y;
  if (!s.ground) {
    // steer onto the ledge we're jumping for
    const below = s.groundAt(x, y + 0.2);
    if (s.vy < 0 && below > y - 3.5 && below > -5) { inp.left = false; inp.right = false; return; }
    inp.right = m.seek > x + 0.3; inp.left = m.seek < x - 0.3; inp.jump = true;
    return;
  }
  if (goalY <= y + 0.5) { inp.right = goalX > x + 0.4; inp.left = goalX < x - 0.4; return; }
  // the nearest ledge 2–3.4 tiles up with room on top, leaning toward the goal
  let best = -1, bestY = 0, bd = 1e9;
  for (let dy = 2; dy <= 3; dy++) for (let dx = -7; dx <= 7; dx++) {
    const tx = Math.floor(x) + dx, ty = Math.floor(y) + dy - 1;
    if (!s.solid(tx, ty) || s.solid(tx, ty + 1) === 1 || s.solid(tx, ty + 2) === 1) continue;
    const d = Math.abs(dx) + Math.abs(tx + 0.5 - goalX) * 0.15;
    if (d < bd) { bd = d; best = tx + 0.5; bestY = ty + 1; }
  }
  if (best < 0) { inp.right = goalX > x; inp.left = goalX < x; if (m.climbT > 1.2) { inp.jump = true; m.hold = 0.3; m.climbT = 0; } return; }
  m.seek = best; void bestY;
  if (Math.abs(best - x) < 0.6 || (s.solid(Math.floor(x), Math.floor(y) + 1) === 2 || s.solid(Math.floor(x), Math.floor(y) + 2) === 2)) { inp.jump = true; m.hold = 0.35; }
  else { inp.right = best > x; inp.left = best < x; }
}

export function botInput(s: Sim, m: BotMem, skill = 1): Input {
  const inp: Input = { left: false, right: true, up: false, down: false, jump: false, fire: false, bomb: false, super: false };
  const x = s.x, y = s.y, dt = 1 / 120, st = s.st;
  const tall = st.h > 40;
  // the cart, the raft and the glider scroll by themselves; the tank and the mech are driven like Puddo on foot
  const auto = st.ride && st.ride.kind !== "tank" && st.ride.kind !== "mech" ? st.ride : undefined;
  m.climbT += dt;
  if (Math.abs(x - m.lastX) < 0.002 && Math.abs(y - m.lastY) < 0.002 && s.ground) m.stuck += dt; else m.stuck = 0;
  m.lastX = x; m.lastY = y;
  if (m.back > 0) { m.back -= dt; inp.right = false; inp.left = true; inp.fire = true; return inp; }
  if (m.stuck > 0.8 && !auto && !tall && s.activeGate < 0) { m.stuck = 0; m.back = 0.35; }
  if (m.hold > 0) { m.hold -= dt; inp.jump = true; }

  // ---- what to shoot: anything in front within range, the boss, targets
  let ahead = 0, crowd = 0, heavy = false;
  for (const f of s.foes) {
    if (!f.alive) continue;
    const dx = (f.x - x) * s.face, dy = f.y - y;
    if (Math.abs(f.x - x) < 12 && Math.abs(dy) < 7) crowd++;
    if (dx > -0.5 && dx < 13 && Math.abs(dy) < dx * 0.75 + 1.2) { ahead++; if ((f.b.b === "hive" || f.b.b === "brute" || f.elite) && dx < 6) heavy = true; }
  }
  const bossOn = !!s.boss?.active && !s.boss.down;
  inp.fire = ahead > 0 || bossOn || st.targets.some((t) => (s.tgtHp.get(t.id) ?? 0) > 0 && Math.abs(t.x - x) < 12 && Math.abs(t.y - y) < 6) || Math.random() < 0.15;
  if (Math.random() > 0.92 + 0.08 * skill) inp.fire = false;
  if ((heavy || (bossOn && Math.abs(s.boss!.x - x) < 6)) && s.bombs > 0 && Math.random() < 0.02 * skill) inp.bomb = true;
  if (s.storm >= 1 && (crowd >= 4 || bossOn)) inp.super = true;

  // ---- the glider: fly through the free rows, dodge, keep shooting
  if (st.ride?.kind === "glider") {
    inp.fire = true; inp.jump = false;
    const tx0 = Math.floor(x);
    const blocked = (yy: number) => [1, 2, 3, 4, 5].some((k) => s.solid(tx0 + k, Math.floor(yy)) === 1 || s.solid(tx0 + k, Math.floor(yy + 1.1)) === 1);
    let target = y;
    if (blocked(y)) { for (let d = 1; d < 14; d++) { if (y + d < st.h - 3 && !blocked(y + d)) { target = y + d; break; } if (y - d > 1.5 && !blocked(y - d)) { target = y - d; break; } } }
    for (const sh of s.shots) if (sh.foe && sh.x - x > -0.5 && sh.x - x < 3 && Math.abs(sh.y - (y + 0.5)) < 1.2) target = sh.y > y + 0.5 ? y - 2 : y + 2;
    inp.up = target > y + 0.3; inp.down = target < y - 0.3;
    return inp;
  }
  // ---- the chimney: wall-jump from side to side
  if (st.rules.walljump && tall && !bossOn) {
    inp.right = false; inp.left = false;
    if (Math.abs(s.vx) > 5) m.cdir = Math.sign(s.vx);
    if (y >= st.goal.y - 0.2 && s.ground) { inp.right = st.goal.x > x + 0.3; inp.left = st.goal.x < x - 0.3; return inp; }
    if (s.ground) { m.cdir = x < st.w / 2 ? 1 : -1; inp.jump = !s.jumpHeld; if (m.cdir > 0) inp.right = true; else inp.left = true; }
    else if (s.wallDir) { if (s.wallDir > 0) inp.right = true; else inp.left = true; inp.jump = !s.jumpHeld; }
    else { if (m.cdir > 0) inp.right = true; else inp.left = true; inp.jump = s.vy > 0; }
    return dodge(s, m, inp);
  }
  // ---- the elevator: ride in the middle, shoot, ring the gong at the top
  if (st.plats.some((p) => p.kind === "elevator") && !bossOn) {
    const gx = st.goal.x, top = y >= st.goal.y - 0.5;
    const want = top ? gx : st.w / 2 + (Math.sin(s.t * 0.7) * 2);
    inp.right = want > x + 0.4; inp.left = want < x - 0.4; inp.fire = true;
    return dodge(s, m, inp);
  }
  // ---- the escort: walk just ahead of the cart and clear its path
  if (st.escort && !s.goalDone) {
    const want = s.escortX + 4;
    if (x > want + 3) { inp.right = false; inp.left = s.face > 0 && x > want + 6; }
    else if (x < want - 1) inp.right = true; else inp.right = false;
    inp.fire = true;
  }
  // ---- cracked walls ahead (the tank and the mech blast through)
  for (let k = 1; k <= 4; k++) if (s.tile(Math.floor(x + k * s.face), Math.floor(y + 0.5)) === T.BREAK) { inp.fire = true; if (k <= 1) inp.right = false; break; }

  // ---- the hunt: never leave an elite behind — stop at range, face it, melt it
  if (st.goalKind === "hunt" && !s.goalDone && s.activeGate < 0) {
    let tgt: (typeof s.foes)[number] | null = null, bd = 1e9;
    for (const f of s.foes) if (f.alive && f.hunt) { const d = Math.abs(f.x - x); if (d < bd) { bd = d; tgt = f; } }
    // every elite left is behind: walk back for it
    if (tgt && !s.foes.some((f) => f.alive && f.hunt && f.x > x - 2)) { inp.right = false; inp.left = true; }
    if (tgt && bd < 9 && s.ground) {
      const dx = tgt.x - x, side = Math.sign(dx) || 1;
      if (seeLine(s, x, y + 0.6, tgt.x, tgt.y + tgt.b.h * 0.5)) {
        m.stuck = 0; inp.right = false; inp.left = false; inp.fire = true;
        const want = tgt.y > y + 2 ? 4.2 : 2.8;
        if (Math.abs(dx) < want - 1.4) { if (side > 0) m.back = 0.12; else inp.right = true; }
        else if (s.face !== side) { if (side > 0) inp.right = true; else inp.left = true; }
        return dodge(s, m, inp);
      }
    }
  }

  // ---- goals that need Puddo to stop or turn: pumps, cages behind him, the well, a key above
  const live = st.targets.filter((t) => (s.tgtHp.get(t.id) ?? 0) > 0);
  const tgBehind = live.find((t) => t.x < x - 0.5 && x - t.x < 14 && Math.abs(t.y - y) < 5);
  const tgAhead = live.find((t) => t.x > x && t.x - x < 7 && Math.abs(t.y - y) < 5);
  if (tgBehind && !auto) { inp.right = false; inp.left = x - tgBehind.x > 5; if (s.face > 0 && x - tgBehind.x <= 5) inp.left = true; inp.fire = true; }
  else if (tgAhead && tgAhead.x - x < 4 && !auto) { inp.right = false; inp.fire = true; if (tgAhead.kind === "pump" && s.bombs > 0 && Math.random() < 0.03) inp.bomb = true; }
  if (st.defend) {
    // stay by the well and face whoever's closest
    const d = st.defend;
    let near = 1e9, side = 1;
    for (const f of s.foes) if (f.alive) { const dd = Math.abs(f.x - d.x); if (dd < near) { near = dd; side = Math.sign(f.x - x) || 1; } }
    inp.right = false; inp.left = false;
    if (Math.abs(x - d.x) > 3) { inp.right = d.x > x; inp.left = d.x < x; }
    else if (near < 1e9) { if (side > 0 && s.face < 0) inp.right = true; else if (side < 0 && s.face > 0) inp.left = true; }
    inp.fire = true;
  }

  // ---- ambush gates and arenas: fight it out inside the walls
  if (s.activeGate >= 0) {
    const g = s.gates[s.activeGate].spec, mid = (g.x0 + g.x1) / 2;
    let tx = mid, nd = 1e9, air = false;
    for (const f of s.foes) if (f.alive && f.gate === g.id) { const dd = Math.abs(f.x - x); if (dd < nd) { nd = dd; tx = f.x; air = f.y > y + 2.5; } }
    const want = tx > x ? 1 : -1;
    inp.right = false; inp.left = false;
    if (air && nd < 3) { if (x - g.x0 > g.x1 - x) inp.left = true; else inp.right = true; }
    else if (nd > 6 || s.face !== want) { if (want > 0) inp.right = true; else inp.left = true; }
    if (nd < 2.2 && s.ground) { inp.jump = true; m.hold = 0.25; }
    inp.fire = true;
  }

  // ---- tall stages: climb to the top, or dive to the bottom
  if (tall && !bossOn && s.activeGate < 0) {
    const up = st.goal.y > st.start.y;
    if (up) { inp.right = false; climbToward(s, m, inp, st.goal.x, st.goal.y); }
    else if (s.ground) {
      // find the way down: a hole or a cracked patch in the floor
      // find the way down: the middle of the nearest run of open or cracked tiles in the floor
      const fy = Math.floor(y) - 1;
      const open = (tx: number) => !s.solid(tx, fy) || s.tile(tx, fy) === T.BREAK;
      let hole = -1, bd = 1e9;
      for (let tx = 2; tx < st.w - 2; tx++) {
        if (!open(tx) || (tx > 2 && open(tx - 1))) continue;
        let e = tx; while (e + 1 < st.w - 2 && open(e + 1)) e++;
        const c = (tx + e + 1) / 2, d = Math.abs(c - x);
        if (d < bd) { bd = d; hole = c; }
      }
      inp.right = false; inp.left = false;
      if (hole >= 0) {
        if (Math.abs(hole - x) > 0.12) { inp.right = hole > x; inp.left = hole < x; }
        else if (s.tile(Math.floor(x), fy) === T.BREAK || s.tile(Math.floor(x - 0.35), fy) === T.BREAK || s.tile(Math.floor(x + 0.35), fy) === T.BREAK) { inp.jump = true; m.hold = 0.12; }
      }
      if (y <= st.goal.y + 0.5) { inp.right = st.goal.x > x; inp.left = st.goal.x < x; }
    } else {
      inp.right = false; inp.left = false;
      for (const k of [0, -0.35, 0.35]) if (s.tile(Math.floor(x + k), Math.floor(y) - 1) === T.BREAK || s.tile(Math.floor(x + k), Math.floor(y) - 2) === T.BREAK) { inp.down = true; inp.fire = true; }
    }
    // shots and enemies on the same level still get shot
    return dodge(s, m, inp);
  }

  // ---- running: v1's platforming brain
  const tx = Math.floor(x), ty = Math.floor(y + 0.3);
  if (!auto && (s.tile(tx, ty) === T.VINE || s.tile(tx, Math.floor(y + 0.05)) === T.VINE)) { inp.up = true; inp.right = s.groundAt(x + 1, y + 0.6) <= y + 0.1 && s.solid(Math.floor(x + 0.6), Math.floor(y + 0.3)) !== 1; if (!inp.right) return inp; }
  if (s.inWater) { if (Math.floor(s.t * 3) % 2 === 0 && s.vy < 1) inp.jump = true; return inp; }
  const dir = inp.left && !inp.right ? -1 : 1;
  if (s.ground) {
    const gNext = s.groundAt(x + 0.75 * dir, y + 0.5);
    const pit = gNext < y - 0.6;
    const wa = auto ? 1.9 : 0.75;
    const wall = s.solid(Math.floor(x + wa * dir), Math.floor(y + 0.4)) === 1 || (!auto && s.solid(Math.floor(x + wa * dir), Math.floor(y + 1.0)) === 1);
    let lowCeil = false;
    for (const k of auto ? [0.5, 1.1, 1.7, 2.3] : [0.9]) if (s.solid(Math.floor(x + k * dir), Math.floor(y + 1.05)) === 1 && s.solid(Math.floor(x + k * dir), Math.floor(y + 0.3)) !== 1) lowCeil = true;
    const tunnel = s.squeezed && (s.solid(tx, Math.floor(y + 1.05)) === 1 || s.solid(tx + dir, Math.floor(y + 1.05)) === 1);
    let haz = false;
    for (let k = 1; k <= 2; k++) { const v = s.tile(Math.floor(x + dir * (0.5 + k * 0.6)), ty); if (HAZ.has(v)) haz = true; }
    if (lowCeil || tunnel) { inp.down = true; return inp; }
    const sw = st.gadgets.find((g) => g.kind === "switch" && g.x - x > 1.9 && g.x - x < 3.1 && Math.abs(g.y - y) < 0.6);
    if (sw && !s.switchOn) { inp.jump = true; m.hold = 0.03; }
    const look = auto ? 1.6 : 1;
    const pitR = auto ? s.groundAt(x + 1.2 + look, y + 0.5) < y - 0.6 || s.groundAt(x + 0.8, y + 0.5) < y - 0.6 : pit;
    if (pitR) {
      let land = -1, landY = y;
      for (let k = 1; k <= 12; k++) { const gy = s.groundAt(x + k * dir, y + 3), top = s.tile(Math.floor(x + k * dir), gy); if (gy > y - 4 && gy > -5 && !HAZ.has(top) && top !== T.WATER) { land = k; landY = gy; break; } }
      // just a step down in front (no gap): walk off it rather than hop over whatever comes after
      const stepDown = !auto && land === 1 && landY < y - 0.5 && s.groundAt(x + 2 * dir, y + 3) >= landY - 0.1;
      const canJump = !stepDown && land > 0 && land <= reach(landY - y) * 0.9 + (auto ? 1.5 : 0);
      if (stepDown) { /* walk off */ }
      else if (canJump || auto) { inp.jump = true; m.hold = auto || landY - y >= 0.9 ? 0.4 : land <= 2 ? 0.1 : land <= 3 ? 0.17 : 0.32; }
      else if (s.onPlat) { inp.right = false; const p = s.onPlat; if (Math.abs(p.x - x) > p.w * 0.3) { inp.right = p.x > x; inp.left = p.x < x; } }
      else {
        const plat = s.plats.find((p) => p.x + p.w / 2 > x + 0.3 && p.x - p.w / 2 < x + 9 && p.y < y + 3.5 && p.y > y - 5);
        if (plat) { const near = plat.x - plat.w / 2 < x + 1.8 && plat.x + plat.w / 2 > x + 0.8 && Math.abs(plat.y - y) < 2.4; if (near) { inp.jump = true; m.hold = 0.2; } else inp.right = false; }
        else { inp.jump = true; m.hold = 0.3; }
      }
    } else if (wall || haz) {
      const top = s.groundAt(x + dir, y + 9);
      // too high to jump: a bounce pad just behind is the way up
      const pad = top - y > 3.2 && [1, 2, 3, 4].some((k) => s.tile(Math.floor(x - dir * k), Math.floor(y) - 1) === T.BOUNCE);
      if (pad) m.back = 0.5;
      else if (s.onPlat && top - y > 2.8) inp.right = false; else { inp.jump = true; m.hold = 0.3; }
    }
    // a mine just ahead: hop it (or it gets shot)
    for (const sh of s.shots) if (sh.foe && sh.kind === "mine" && (sh.x - x) * dir > 0.6 && (sh.x - x) * dir < 1.8 && Math.abs(sh.y - y) < 1) { inp.jump = true; m.hold = 0.2; }
  }
  if (!s.ground && s.vy < 0 && !s.inWater && !auto) {
    const below = s.groundAt(x, y + 0.2);
    const pl = s.plats.find((p) => Math.abs(p.x - x) < p.w / 2 - 0.2 && p.y < y + 0.2 && p.y > y - 4);
    if (pl) { if (Math.abs(pl.x - x) > pl.w * 0.15) { inp.right = pl.x > x; inp.left = pl.x < x && s.vx > 0.5; } }
    else if (below > -5 && below > y - 4) {
      const aheadPit = s.groundAt(x + 0.8, y + 0.2) < below - 0.5;
      const far = s.groundAt(x + 2.2, y + 0.2) >= below - 0.5;
      if (aheadPit && !far) { inp.right = false; inp.left = s.vx > 1.5; }
    }
  }
  for (const g of st.gadgets) {
    const dx = g.x - x;
    if (dx < -0.5 || dx > 3) continue;
    if ((g.kind === "laser" && s.gs(g) === 1) || (g.kind === "geyser" && s.gs(g) >= 1) || g.kind === "crusher") {
      if (g.kind === "crusher") { const c = s.cyc(g); if (c > 0.25 && c < 0.8 && dx > 0.4 && dx < 2.4) inp.right = false; }
      else if (dx > 0.4 && dx < 1.8) inp.right = false;
    }
    if ((g.kind === "bonfire" || g.kind === "spider") && dx > 0.2 && dx < 1.6 && s.ground) { inp.jump = true; m.hold = 0.25; }
  }
  // enemies close in front: hop over the ones that touch
  for (const f of s.foes) {
    if (!f.alive) continue;
    const dx = (f.x - x) * dir, dy = f.y - y;
    if (dx < -0.4 || dx > 2) continue;
    if (dx < 1.7 && Math.abs(dy) < 1.4 && s.ground && f.b.b !== "hive" && f.b.b !== "turret") { inp.jump = true; m.hold = 0.3; }
  }
  // the boss: keep a little distance and keep firing
  if (bossOn) {
    const b = s.boss!, dx = b.x - x;
    const want = Math.abs(dx) < 5 ? -Math.sign(dx) : Math.abs(dx) > 9 ? Math.sign(dx) : 0;
    inp.right = want > 0; inp.left = want < 0;
    if (want === 0 && Math.sign(dx) !== s.face) { if (dx > 0) inp.right = true; else inp.left = true; }
    if (Math.abs(dx) < 3 && s.ground) { inp.jump = true; m.hold = 0.3; }
    if (Math.abs(b.vx) > 5 && Math.sign(b.vx) === Math.sign(-dx) && Math.abs(dx) < 6 && s.ground) { inp.jump = true; m.hold = 0.4; }
    if (Math.abs(dx) < 6 && s.bombs > 0 && Math.random() < 0.01) inp.bomb = true;
    inp.fire = true;
  }
  if (s.boss?.down) { const bell = st.gadgets.find((g) => g.kind === "bell"); if (bell) { inp.right = bell.x > x; inp.left = bell.x < x - 0.3; if (s.ground && Math.abs(bell.x - x) < 2) { inp.jump = true; m.hold = 0.3; } } }
  if (st.rules.chase) { inp.right = true; inp.left = false; }
  // a locked door ahead: go back for what's missing
  if (!s.goalDone && (st.goalKind === "pumps" || st.goalKind === "rescue" || st.goalKind === "keys") && s.solid(Math.floor(x + 1.2), Math.floor(y + 0.5)) === 1 && s.tile(Math.floor(x + 1.2), Math.floor(y + 0.5)) === T.DOOR) { m.back = 2.5; }
  return dodge(s, m, inp);
}

/** hop over enemy shots coming at Puddo's body */
/** nothing solid on the straight line between two points */
function seeLine(s: Sim, x0: number, y0: number, x1: number, y1: number) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.3);
  for (let i = 1; i < n; i++) { const t = i / n; if (s.solid(Math.floor(x0 + (x1 - x0) * t), Math.floor(y0 + (y1 - y0) * t)) === 1) return false; }
  return true;
}
function dodge(s: Sim, m: BotMem, inp: Input): Input {
  // a sniper's red line: step out of it before the shot
  for (const f of s.foes) {
    if (!f.alive || f.b.b !== "sniper" || f.tell <= 0 || Math.abs(f.ax - s.x) > 1.3 || Math.random() > 0.9) continue;
    const away = s.x > s.st.w - 4 ? -1 : s.x < 4 ? 1 : f.ax <= s.x ? 1 : -1;
    inp.right = away > 0; inp.left = away < 0;
  }
  for (const sh of s.shots) {
    if (!sh.foe || sh.kind === "mine") continue;
    const dx = sh.x - s.x, dy = sh.y - (s.y + 0.5);
    const coming = sh.vx * -dx > 0 || Math.abs(sh.vx) < 0.5;
    if (Math.abs(dx) < 2.4 && Math.abs(dy) < 1.4 && coming && s.ground && Math.random() < 0.85) {
      if (sh.y > s.y + 1.0 && sh.y < s.y + 1.7) inp.down = true; else { inp.jump = true; m.hold = 0.25; }
    }
  }
  return inp;
}
