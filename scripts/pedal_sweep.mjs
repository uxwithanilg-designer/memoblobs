// Obby Bike Blaster QA: a bot rides levels with the real course builder and bike physics (no browser) and reports
// whether each can be finished, how long it takes, how many falls it costs and where it gets stuck.
//   node scripts/pedal_sweep.mjs [from] [to] [step] [bike]      e.g. node scripts/pedal_sweep.mjs 1 1200 37 bmx
//   TRACE=1 node scripts/pedal_sweep.mjs 5 5     (log the bot every half second)
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const MODS = ["util", "worlds", "course", "physics", "gear"];
const tmp = mkdtempSync(join(tmpdir(), "pedal-"));
for (const m of MODS) {
  const js = ts.transpileModule(readFileSync(`src/pedal/${m}.ts`, "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    .replace(/from "\.\/([\w-]+)"/g, 'from "./$1.mjs"');
  writeFileSync(join(tmp, `${m}.mjs`), js);
}
const imp = (m) => import(pathToFileURL(join(tmp, `${m}.mjs`)).href);
const { levelPlan, buildCourse, moveAt } = await imp("course");
const { Bike, CourseWorld } = await imp("physics");
const { statsFor, NO_UPGRADES } = await imp("gear");
const { WORLDS } = await imp("worlds");
rmSync(tmp, { recursive: true, force: true });

const [from = 1, to = 20, step = 1, bikeId = "bmx"] = process.argv.slice(2);
const TRACE = !!process.env.TRACE;
const DT = 1 / 60;

function ride(n) {
  const plan = levelPlan(n);
  // FORCE=lifts D=0.8 rides a course made only of one pattern at one difficulty
  if (process.env.FORCE) { plan.pool = [process.env.FORCE]; plan.difficulty = +(process.env.D ?? 0.5); plan.sections = 10; }
  const C = buildCourse(plan), W = new CourseWorld(C), w = WORLDS.find((x) => x.id === plan.world);
  const grav = w.gravity * (plan.mods.includes("lowgrav") && w.id !== "moon" ? 0.6 : 1);
  const st = statsFor(bikeId, NO_UPGRADES);
  const b = new Bike();
  const dyn = C.pieces.filter((p) => p.move || p.spin || p.kind === "fall" || p.kind === "bridge" || p.kind === "crate" || p.kind === "target" || p.kind === "laser");
  let section = -1, t = 0, trapT = 0, falls = 0, stuck = 0, lastZ = -1e9, worst = { at: "", n: 0 };
  const fallsAt = new Map();
  const respawn = () => { const c = section >= 0 ? C.checkpoints[section] : C.start; b.place(c.x, c.y, c.z, 0); for (const p of dyn) if (p.kind === "fall") { p.t = 0; p.dy = 0; } };
  respawn();
  const G = { y: 0, p: null };
  const angleOf = (p) => (p.spin.swing ? Math.sin(trapT * p.spin.speed + p.spin.phase) * 1.05 : p.spin.phase + trapT * p.spin.speed);
  let inv = 0, lastG = null, lastGz = 0, slowT = 0, wait0 = false;
  /** will a ferry's middle stay within a metre of x for the next dur seconds? */
  const stays = (p, x, t0, dur) => {
    for (let tau = 0; tau <= dur; tau += 0.1) if (Math.abs((p.x0 + p.x1) / 2 + moveAt(p.move, t0 + tau) - x) > 1) return false;
    return true;
  };
  /** a ferry's sideways speed now */
  const ferryV = (p, t) => (moveAt(p.move, t + 0.05) - moveAt(p.move, t - 0.05)) / 0.1;
  const angleAt = (p, t) => (p.spin.swing ? Math.sin(t * p.spin.speed + p.spin.phase) * 1.05 : p.spin.phase + t * p.spin.speed);
  /** a moving hazard that would hit the bike at (x, y, z) at trap time t (with a little margin) */
  const hazardAt = (x, y, z, t) => {
    for (const p of W.near(z) ?? []) {
      if (p.kind === "laser") {
        if (Math.sin((t / p.move.period) * Math.PI * 2 + p.move.phase) > -0.25 && x > p.x0 - 0.35 && x < p.x1 + 0.35 && z > p.z0 - 0.5 && z < p.z1 + 0.5 && y + 1.2 > p.y0 && y < p.y1 - 0.05) return p;
      } else if (p.kind === "spinner") {
        const a = angleAt(p, t), sp = p.spin, dx = x - sp.cx, dz = z - sp.cz, lx = dx * Math.cos(a) - dz * Math.sin(a), lz = dx * Math.sin(a) + dz * Math.cos(a);
        if (Math.abs(lx) < sp.len / 2 + 0.2 && Math.abs(lz) < 0.85 && y < sp.cy + 0.25 && y > sp.cy - 1.4) return p;
      } else if (p.kind === "hammer") {
        const a = angleAt(p, t), sp = p.spin, hx = sp.cx + Math.sin(a) * sp.len, hy = sp.cy - Math.cos(a) * sp.len;
        if (Math.abs(x - hx) < 1.35 && Math.abs(y + 0.8 - hy) < 1.45 && Math.abs(z - sp.cz) < 1.35) return p;
      }
    }
    return null;
  };
  /** riding on at full pedal along our heading: the first hazard we'd meet within the horizon */
  const goHit = (horizon, jumpAt = -1) => {
    const hx = Math.sin(b.yaw), hz = Math.cos(b.yaw);
    let v = Math.max(0, b.speed), s = 0, y = b.y, vy = 0, air = false;
    for (let tau = 0.05; tau <= horizon; tau += 0.05) {
      if (!air && jumpAt >= 0 && tau >= jumpAt) { air = true; vy = st.jump; jumpAt = -1; }
      if (air) { vy -= grav * 0.05; y += vy * 0.05; if (y <= b.y) { y = b.y; air = false; } }
      else v = Math.min(st.speed, v + st.accel * 0.05);
      s += v * 0.05;
      const h = hazardAt(b.x + hx * s, y, b.z + hz * s, trapT + tau);
      if (h) return { tau, s, h };
    }
    return null;
  };
  /** where a jump in progress comes down if the forward speed were scaled */
  const LG = { y: 0, p: null };
  const landing = (scale) => {
    // the bike's velocity eases toward its forward speed in the air (as in physics.ts), so follow that
    let x = b.x, y = b.y, z = b.z, vy = b.vy, vx = b.vx, vz = b.vz;
    const tx = Math.sin(b.yaw) * b.speed * scale, tz = Math.cos(b.yaw) * b.speed * scale, k = Math.pow(0.5, 0.02 / 0.3);
    for (let i = 0; i < 120; i++) {
      vx = tx + (vx - tx) * k; vz = tz + (vz - tz) * k;
      const py = y; vy -= grav * 0.02; y += vy * 0.02; x += vx * 0.02; z += vz * 0.02;
      W.ground(x, z, py + 0.42, LG);
      if (LG.p && y <= LG.y && vy <= 0) { const m = vz >= 0 ? LG.p.z1 + LG.p.dz - z : z - LG.p.z0 - LG.p.dz; return { m, score: LG.y * 10 + Math.min(m, 2) }; }
      if (y < C.minY - 4) return null;
    }
    return null;
  };
  while (t < 60 * 40) {
    t += DT; trapT += DT;
    // traps
    for (const p of dyn) {
      if (p.move && p.kind !== "laser") { const v = moveAt(p.move, trapT); if (p.move.ax === 0) p.dx = v; else if (p.move.ax === 1) p.dy = v; else p.dz = v; }
      if (p.kind === "laser") p.on = Math.sin((trapT / p.move.period) * Math.PI * 2 + p.move.phase) > -0.15;
      if (p.kind === "fall" && p.t > 0) { p.t += DT; if (p.t > 0.55) p.dy -= DT * (6 + (p.t - 0.55) * 22); if (p.t > 5) { p.t = 0; p.dy = 0; } }
      if (p.kind === "bridge" && !p.on && p.hp === 99) { p.t += DT * 4; if (p.t >= 1) { p.on = true; p.t = 1; } }
      // the blaster: targets and crates within 26 m ahead get shot
      if ((p.kind === "target" || p.kind === "crate") && p.on && p.z0 > b.z && p.z0 - b.z < 26 && Math.abs((p.x0 + p.x1) / 2 - b.x) < 12) {
        p.t = (p.t || 0) + DT;
        if (p.t > (p.kind === "crate" ? 0.5 : 0.3)) {
          p.on = false;
          if (p.kind === "target") { let z0 = Infinity; for (const q of dyn) if (q.kind === "bridge" && q.group === p.group) z0 = Math.min(z0, q.z0); for (const q of dyn) if (q.kind === "bridge" && q.group === p.group) { q.hp = 99; q.t = -(q.z0 - z0) * 0.08; } }
        }
      }
    }
    // the bot: aim at the path a few metres ahead (the piece under that point nearest our line), steer through the
    // gaps in kill rows, and jump only over real gaps, steps and kill blocks it can't go around
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
    const look = Math.max(4, Math.abs(b.speed) * 0.65 + 1.5);
    let pathP = null;
    const pathAt = (z) => {
      let bx = null, bd = 1e9;
      for (const p of W.near(z) ?? []) {
        if (!CourseWorld.stands(p) || z < p.z0 + p.dz || z > p.z1 + p.dz) continue;
        const top = CourseWorld.topAt(p, (p.x0 + p.x1) / 2 + p.dx, z);
        if (top > b.y + 3.6 || top < b.y - 6) continue;
        // the piece we're on: keep our line; another piece: head for its middle
        const onIt = b.onGround && b.ground === p;
        const mid = p.move?.ax === 0 ? (p.x0 + p.x1) / 2 + (Math.abs((p.x0 + p.x1) / 2 + p.move.amp - b.x) < Math.abs((p.x0 + p.x1) / 2 - p.move.amp - b.x) ? p.move.amp : -p.move.amp) : (p.x0 + p.x1) / 2 + p.dx;
        const cx = onIt ? Math.max(p.x0 + p.dx + 0.6, Math.min(p.x1 + p.dx - 0.6, b.x)) : mid;
        const dd = Math.abs(cx - b.x) + Math.abs(top - b.y) * 0.3;
        if (dd < bd) { bd = dd; bx = cx; pathP = p; }
      }
      return bx;
    };
    let tx = pathAt(b.z + look), tz = b.z + look;
    if (tx === null) { for (let k = 1; k <= 14 && tx === null; k++) { tx = pathAt(b.z + look + k); tz = b.z + look + k; } }
    if (tx === null) tx = b.x;
    // a kill row ahead: aim for the middle of its opening, early
    let slow = false;
    for (let k = 0; k <= 2; k++) for (const p of W.near(b.z + 1 + k * 4) ?? []) {
      if (p.kind !== "kill" || p.z0 < b.z + 0.3 || p.z0 > b.z + 9 || p.y0 > b.y + 0.5 || p.y1 < b.y) continue;
      if (tz < p.z0 && Math.abs(p.z0 - b.z) > Math.abs(tz - b.z) + 1) continue;
      let run = null, bestRun = null, bd = 1e9;
      for (let x = Math.floor(b.x - 7); x <= b.x + 7; x += 0.25) {
        let blocked = false;
        for (const q of W.near(p.z0) ?? []) if (q.kind === "kill" && Math.abs(q.z0 - p.z0) < 0.1 && x > q.x0 - 0.4 && x < q.x1 + 0.4) blocked = true;
        G.p = null; W.ground(x, p.z0 + 0.5, b.y + 0.42, G);
        const free = !blocked && G.p && Math.abs(G.y - b.y) < 0.5;
        if (free) { if (!run) run = [x, x]; else run[1] = x; }
        // the nearest point of the nearest opening wide enough to ride through
        if ((!free || x + 0.25 > b.x + 7) && run) { if (run[1] - run[0] >= 0.9) { const at = Math.max(run[0] + 0.45, Math.min(run[1] - 0.45, b.x)); if (Math.abs(at - b.x) < bd) { bd = Math.abs(at - b.x); bestRun = at; } } run = null; }
      }
      if (bestRun !== null) { tx = bestRun; tz = p.z0 + 0.5; slow = Math.abs(bestRun - b.x) > 1; }
      k = 99; break;
    }
    if (b.onGround && b.ground && pathP && pathP !== b.ground) {
      const g = b.ground, gx0 = g.x0 + g.dx, gx1 = g.x1 + g.dx, px0 = pathP.x0 + pathP.dx, px1 = pathP.x1 + pathP.dx;
      if (tx > gx0 + 0.5 && tx < gx1 - 0.5 && (b.x < px0 + 0.4 || b.x > px1 - 0.4) && tz > g.z1 + g.dz - 0.5) tz = Math.min(tz, Math.max(b.z + 1.2, g.z1 + g.dz - 1.8));
    }
    // on belts and ice steer the way you're actually moving, so the bot leans into the push
    const slide = b.onGround && (b.ground?.kind === "belt" || b.ground?.kind === "ice") && Math.abs(b.speed) > 1;
    let d = Math.atan2(tx - b.x, tz - b.z) - (slide ? Math.atan2(b.vx, b.vz) : b.yaw);
    while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    let steer = Math.max(-1, Math.min(1, -d * 3));
    let jump = false;
    const ax = b.x + fx * 0.8, az = b.z + fz * 0.8;
    W.ground(ax, az, b.y + 1.6, G);
    if (b.onGround && (!G.p || G.y < b.y - 0.6)) {
      // a gap under a metre rides over by itself; jump anything longer, or a drop or a step up
      let far = null;
      for (let k = 1.0; k <= 7 && far === null; k += 0.2) { W.ground(b.x + fx * k, b.z + fz * k, b.y + 1.6, G); if (G.p && G.y > b.y - 0.6) far = k; }
      W.ground(b.x + fx * (far ?? 2.4), b.z + fz * (far ?? 2.4), b.y + 1.6, G);
      if (far === null || far > 1.8 || G.y > b.y + 0.42) jump = true;
    }
    const wd = 1.1 + Math.max(0, b.speed) * 0.12;
    if (b.onGround) for (const o of [0, -0.35, 0.35]) if (W.wallAt(b.x + fx * wd + fz * o, b.y + 0.7, b.z + fz * wd - fx * o, b.y)) jump = true;
    // pressed up against something and not moving: hop
    if (b.onGround && Math.abs(b.speed) < 0.6) slowT += DT; else slowT = 0;
    if (slowT > 0.8 && !wait0) { jump = true; slowT = 0; }
    // hop low kill strips that lie across our line
    if (b.onGround && !jump) for (const p of W.near(b.z + 2) ?? []) {
      if (p.kind !== "kill" || p.y1 - p.y0 > 0.5 || p.y0 > b.y + 0.3 || p.y1 < b.y) continue;
      const ahead = p.z0 - b.z;
      if (ahead < 0.9 || ahead > 0.9 + Math.max(0, b.speed) * 0.15) continue;
      const px = b.x + (fx / Math.max(0.3, fz)) * ahead;
      if (px > p.x0 - 0.35 && px < p.x1 + 0.35) jump = true;
    }
    let hold = false;
    if (b.onGround) {
      const hit = goHit(1.6);
      if (hit) {
        // is there a moment to hop that gets us through? hop now if that moment is now
        let hopAt = -1;
        if (hit.h.kind === "spinner") for (let j = 0.05; j <= hit.tau && hopAt < 0; j += 0.05) if (!goHit(Math.min(1.6, hit.tau + 0.7), j - 0.05)) hopAt = j - 0.05;
        if (hopAt >= 0) { if (hopAt < 0.05) jump = true; }
        else if (hit.s > (b.speed * b.speed) / (2 * st.accel * 1.7) + 0.6 || b.speed < 1) hold = true;
      }
      if (hold) { const h = hazardAt(b.x, b.y, b.z, trapT + 0.2); if (h) { hold = false; if (h.kind === "spinner") jump = true; } }
    }
    // a moving platform ahead across a gap: wait at the edge until it lines up (sliders: centred; lifts: level)
    let wait = false, first = null;
    if (b.onGround && !b.ground?.move) {
      // only the first moving platform ahead matters (the next lift up is for later)
      for (let k = 0; k <= 2; k++) for (const p of W.near(b.z + 1 + k * 4) ?? []) if (p.move && p.kind !== "laser" && p.z0 >= b.z && p.z0 - b.z <= 9 && (!first || p.z0 < first.z0)) first = p;
      for (const p of first ? [first] : []) {
        const top = p.y1 + p.dy;
        if (p.move.ax === 0 && !stays(p, b.x, trapT, (p.z0 - b.z + 0.8) / Math.max(1.6, b.speed) + 0.2)) wait = true;
        if (p.move.ax === 1 && (top > b.y + 0.3 || top < b.y - 0.5)) wait = true;
      }
    }
    // on a lift: stay until it reaches the ledge; on a slider: ride off when the next deck lines up
    let exitNear = false;
    if (b.onGround && b.ground?.move) {
      const g = b.ground;
      for (const p of W.near(g.z1 + 2) ?? []) {
        if (p.move || !CourseWorld.stands(p) || p.z0 < g.z1 - 0.1 || p.z0 > g.z1 + 2.5) continue;
        if (g.move.ax === 1 && Math.abs(p.y1 - (g.y1 + g.dy)) > 0.35) wait = true;
        // a ferry: roll off once the far deck is under us and the ferry has (nearly) stopped
        if (g.move.ax === 0) { exitNear = true; if (b.x < p.x0 + 0.3 || b.x > p.x1 - 0.3 || Math.abs(ferryV(g, trapT)) > 1) wait = true; }
      }
    }
    // on a ferry keep your line: the ferries in a row move together and stop beside the next deck
    if (wait || (b.onGround && b.ground?.move?.ax === 0)) {
      // on a ferry ride its middle (it rests in line with the far deck); otherwise hold our line
      tx = b.ground?.move?.ax === 0 ? (b.ground.x0 + b.ground.x1) / 2 + b.ground.dx : b.ground ? Math.max(b.ground.x0 + b.ground.dx + 0.7, Math.min(b.ground.x1 + b.ground.dx - 0.7, b.x)) : b.x;
      // waiting for a ferry: line up with where it rests on our side
      if (first?.move?.ax === 0 && b.ground && !b.ground.move) { const c = (first.x0 + first.x1) / 2, e = Math.abs(c + first.move.amp - b.x) < Math.abs(c - first.move.amp - b.x) ? c + first.move.amp : c - first.move.amp; tx = Math.max(b.ground.x0 + 0.6, Math.min(b.ground.x1 - 0.6, e)); }
      tz = b.z + 4;
      d = Math.atan2(tx - b.x, tz - b.z) - b.yaw;
      while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      steer = Math.max(-1, Math.min(1, -d * 3));
    }
    // slow down before a sharp turn
    const nearEdge = (() => { G.p = null; W.ground(b.x + fx * 1.6, b.z + fz * 1.6, b.y + 0.42, G); return !G.p || G.y < b.y - 0.6; })();
    const brake = b.speed > 0.3 ? -1 : b.speed < -0.3 ? 0.6 : 0;
    // waiting: creep up to a metre short of the end of the deck we're on, never into the gap
    let toEnd = 0;
    if (b.onGround) { toEnd = 3; for (let k = 0.25; k <= 3; k += 0.25) { W.ground(b.x + fx * k, b.z + fz * k, b.y + 0.42, G); if (!G.p || G.y < b.y - 0.3) { toEnd = k; break; } } }
    let thr = wait ? (nearEdge || toEnd < 0.8 || Math.abs(b.speed) > 2 ? brake : 0.3) : Math.abs(d) > 0.9 && b.speed > 5 ? -1 : Math.abs(d) > 0.6 ? -0.4 : slow ? (b.speed > 5 ? -0.6 : 0.4) : 1;
    // on ice, slow down when there are posts ahead
    if (b.onGround && b.speed > 6.5) for (let k = 0; k <= 2; k++) for (const p of W.near(b.z + k * 4) ?? []) if (p.kind === "ice" && p.z1 > b.z + 2 && p.z0 < b.z + 8) thr = Math.min(thr, -0.5);
    if (hold) thr = brake;
    // ferries: ride them slowly enough to stop at the front and wait for the far deck
    if (b.onGround && b.ground?.move?.ax === 0 && !wait && !exitNear) thr = b.speed > 4 ? brake : Math.min(thr, 0.5);
    // board a lift slowly enough to stop on it
    if (b.onGround && first?.move?.ax === 1 && first.z0 - b.z < 8 && b.speed > 5) thr = brake;
    if (b.onGround && b.ground?.move?.ax === 0 && wait) thr = b.ground.z1 - b.z > 1.5 && Math.abs(b.speed) < 2 ? 0.3 : brake;
    wait0 = wait || hold;
    if (wait || hold) jump = false;
    // in the air: pull back if we'd overshoot the piece we're coming down on (or miss it)
    if (!b.onGround && b.speed > 2) {
      const full = landing(1);
      if (!full || full.m < 1) for (const k of [0.85, 0.7, 0.55, 0.4]) { const brk = landing(k); if (brk && (!full || brk.score > full.score)) { thr = -1; break; } }
    }
    b.step(DT, { throttle: thr, steer, jump }, W, st, grav, 1, false);
    // checkpoints, finish, hazards
    const g = b.onGround ? b.ground : null;
    if (g) { lastG = g; lastGz = b.z; }
    if (g && g.kind === "cp" && g.section > section) section = g.section;
    if (g && g.kind === "finish") return { n, world: w.name, done: true, t: Math.round(t), falls, sections: C.sections, len: Math.round(C.length), worst };
    if (g && g.kind === "fall" && g.t === 0) g.t = 0.001;
    let dead = b.y < C.minY - 14, why = dead ? "fell" : "";
    if (inv > 0) inv -= DT;
    else for (const p of W.near(b.z) ?? []) {
      if (p.kind === "kill" || (p.kind === "laser" && p.on)) { if (b.x > p.x0 + p.dx - 0.25 && b.x < p.x1 + p.dx + 0.25 && b.z > p.z0 + p.dz - 0.35 && b.z < p.z1 + p.dz + 0.35 && b.y + 1.2 > p.y0 + p.dy && b.y < p.y1 + p.dy - 0.05) { dead = true; why = p.kind; } }
      else if (p.kind === "spinner") { const a = angleOf(p), s = p.spin, dx = b.x - s.cx, dz = b.z - s.cz, lx = dx * Math.cos(a) - dz * Math.sin(a), lz = dx * Math.sin(a) + dz * Math.cos(a); if (Math.abs(lx) < s.len / 2 && Math.abs(lz) < 0.6 && b.y < s.cy + 0.25 && b.y > s.cy - 1.4) { dead = true; why = "spinner"; } }
      else if (p.kind === "hammer") { const a = angleOf(p), s = p.spin, hx = s.cx + Math.sin(a) * s.len, hy = s.cy - Math.cos(a) * s.len; if (Math.abs(b.x - hx) < 1.1 && Math.abs(b.y + 0.8 - hy) < 1.3 && Math.abs(b.z - s.cz) < 1.1) { dead = true; why = "hammer"; } }
    }
    if (dead) {
      falls++;
      if (process.env.WHY && falls <= +process.env.WHY) console.log("dead", why, "sec", section + 1, "z", b.z.toFixed(1), "x", b.x.toFixed(1), "y", b.y.toFixed(1), "lastGround", lastG && `${lastG.kind}/${lastG.mat} z${lastG.z0}-${lastG.z1} x${(lastG.x0+lastG.dx).toFixed(1)}..${(lastG.x1+lastG.dx).toFixed(1)} y${(lastG.y1+lastG.dy).toFixed(1)}`, "at", lastGz.toFixed(1));
      const at = C.patterns[Math.min(C.patterns.length - 1, section + 1)];
      fallsAt.set(at, (fallsAt.get(at) ?? 0) + 1);
      const k = fallsAt.get(at); if (k > worst.n) worst = { at, n: k };
      respawn(); inv = 1.2;
      // give up on a spot after 40 falls at one checkpoint
      if (falls > 400) break;
    }
    if (Math.abs(b.z - lastZ) < 0.005) stuck += DT; else stuck = 0;
    lastZ = b.z;
    if (stuck > 15) return { n, world: w.name, done: false, t: Math.round(t), falls, cp: section + 1, sections: C.sections, stuckAt: C.patterns[Math.min(C.patterns.length - 1, section + 1)], z: Math.round(b.z), worst };
    if (process.env.TZ0 && b.z > +process.env.TZ0 && b.z < +process.env.TZ1) console.log("f", t.toFixed(2), b.x.toFixed(2), b.y.toFixed(2), b.z.toFixed(2), b.vy.toFixed(2), b.onGround, b.ground?.kind, jump, b.ground ? (b.ground.x0 + b.ground.dx).toFixed(2) : "", b.speed.toFixed(1), thr.toFixed(1), wait, hold);
    if (TRACE && Math.round(t * 60) % 30 === 0) console.log(t.toFixed(1), section, b.x.toFixed(1), b.y.toFixed(1), b.z.toFixed(1), b.speed.toFixed(1), b.onGround);
  }
  return { n, world: w.name, done: false, t: Math.round(t), falls, cp: section + 1, sections: C.sections, timeout: true, worst };
}

let ok = 0, all = 0, totalT = 0;
for (let n = +from; n <= +to; n += +step) {
  const r = ride(n);
  all++; if (r.done) { ok++; totalT += r.t; }
  console.log(JSON.stringify(r));
}
console.log(`done ${ok}/${all}${ok ? ` · average ${Math.round(totalT / ok)} s` : ""}`);
