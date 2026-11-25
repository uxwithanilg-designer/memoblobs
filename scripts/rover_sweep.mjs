// Peak Rover QA: a bot drives stages with the real physics (no browser) and reports whether each can be finished,
// how long it takes, how many crashes it costs, and anything broken (NaN, getting stuck, running dry).
//   node scripts/rover_sweep.mjs [from] [to] [step] [vehicle] [upgrade level]   e.g. node scripts/rover_sweep.mjs 1 600 25 buggy
//   BOT=naive node scripts/rover_sweep.mjs ...   (full gas everywhere: a careless player)
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const MODS = ["util", "worlds", "stages", "terrain", "physics", "vehicles"];
const tmp = mkdtempSync(join(tmpdir(), "rover-"));
for (const m of MODS) {
  const js = ts.transpileModule(readFileSync(`src/rover/${m}.ts`, "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    .replace(/from "\.\/([\w-]+)"/g, 'from "./$1.mjs"');
  writeFileSync(join(tmp, `${m}.mjs`), js);
}
const imp = (m) => import(pathToFileURL(join(tmp, `${m}.mjs`)).href);
const { buildTrack } = await imp("terrain");
const { Rover, STEP } = await imp("physics");
const { tuned, vehicleOf, NO_UPGRADES } = await imp("vehicles");
rmSync(tmp, { recursive: true, force: true });

const [from = 1, to = 60, step = 1, vid = "buggy", lvl = "0"] = process.argv.slice(2);
/** BOT=naive: full gas everywhere (how far does no skill get you?); default: a careful driver */
const BOT = process.env.BOT ?? "careful";
/** TRACE=x0-x1: log the car while it is between those metres (debugging a hard spot) */
const TRACE = process.env.TRACE ? process.env.TRACE.split("-").map(Number) : null;
const L = Number(lvl);
const levels = { engine: L, suspension: L, tires: L, tank: L };

function drive(n) {
  const tr = buildTrack(n), T = tr.terrain;
  const spec = tuned(vehicleOf(vid), L ? levels : NO_UPGRADES);
  const R = new Rover(spec);
  R.gravity = tr.world.gravity * (tr.plan.twist === "lowgrav" ? 0.55 : 1); R.gripMul = tr.world.grip;
  let cp = 0, crashes = 0, t = 0, fuel = spec.fuel, dry = 0, nan = false, stuckAt = -1, tries = 0;
  const why = { head: 0, pit: 0, fuel: 0, stuck: 0, flipped: 0 };
  const place = () => { R.place(T, cp > 0 ? tr.checkpoints[cp - 1] + 2 : 2); fuel = spec.fuel; dry = 0; };
  place();
  const items = tr.items.map((i) => ({ ...i }));
  let lastProgress = 0, lastProgressT = 0;
  const p = { gas: 0, brake: 0 };
  while (t < 900) {
    // the bot: full gas on the ground unless pulling a wheelie; in the air, match the ground ahead
    const ahead = R.x + Math.max(2, R.vx * 0.5);
    const slopeA = Math.atan(T.slopeAt(ahead));
    const rel = R.a - slopeA;
    if (BOT === "naive") { p.gas = 1; p.brake = 0; } // a careless player: foot down, always
    else if (R.grounded) {
      p.gas = rel > 0.55 ? 0 : 1; p.brake = rel > 0.9 ? 0.6 : 0;
      // slow down for rough ground ahead (rocks, steps, whoops): how much the slope changes over the next 20 m
      // (kickers and gaps want speed, so their run-ups and lips don't count)
      let rough = 0;
      for (let q = 2; q < 22; q += 1) {
        const xq = R.x + q;
        if (tr.ramps.some((rp) => xq > rp - 50 && xq < rp + 30) || tr.pits.some((pp) => xq > pp.x0 - 50 && xq < pp.x1 + 20)) continue;
        rough = Math.max(rough, Math.abs(T.slopeAt(xq) - T.slopeAt(xq - 1)));
      }
      let cap = rough > 0.35 ? 9 : rough > 0.2 ? 13 : 99;
      // and before a crest (a hilltop that would launch the car; on the moon even a small one does)
      let crest = 0;
      for (let q = 2; q < 12; q += 1) crest = Math.max(crest, T.slopeAt(R.x + 1) - T.slopeAt(R.x + q));
      if (crest > 0.35) cap = Math.min(cap, R.gravity < 6 ? 7 : 12);
      // like a player, it changes its approach after a failed try: careful on even tries, with momentum on odd ones
      if (tries % 2 === 0 && R.forward > cap) { p.gas = 0; p.brake = R.forward > cap + 3 ? 0.5 : 0; }
    }
    else {
      // in the air: steer the spin towards the ground's angle (aim for a spin rate, not just an angle, or it overshoots)
      const want = -3 * rel, err = R.w - want;
      p.gas = err < -0.25 ? 1 : 0; p.brake = err > 0.25 ? 1 : 0;
    }
    if (fuel <= 0) p.gas = 0;
    for (let k = 0; k < 4; k++) R.step(T, p);
    t += STEP * 4;
    if (TRACE && R.x > TRACE[0] && R.x < TRACE[1] && Math.round(t * 60) % 15 === 0) console.log(`  t=${t.toFixed(2)} x=${R.x.toFixed(1)} v=${R.forward.toFixed(1)} a=${(R.a * 57.3).toFixed(0)}° slope=${(slopeA * 57.3).toFixed(0)}° gas=${p.gas} brake=${p.brake} air=${!R.grounded} spin0=${R.omega[0].toFixed(0)} try=${tries}`);
    fuel -= spec.fuelUse * (0.22 + 0.78 * p.gas) * STEP * 4;
    if (!Number.isFinite(R.x + R.y + R.a)) { nan = true; break; }
    for (const it of items) { if (it.taken || Math.abs(it.x - R.x) > 2) continue; if (Math.hypot(it.x - R.x, it.y - R.y - 0.45) < 1.6) { it.taken = true; if (it.kind === "fuel") fuel = spec.fuel; } }
    if (cp < tr.checkpoints.length && R.x > tr.checkpoints[cp]) { cp++; tries = 0; }
    const pit = tr.pits.some((q) => R.x > q.x0 && R.x < q.x1 && R.y < T.heightAt(q.x0) - 5);
    dry = fuel <= 0 && R.speed < 0.5 ? dry + STEP * 4 : 0;
    if (R.x > lastProgress + 3) { lastProgress = R.x; lastProgressT = t; }
    const stuck = t - lastProgressT > 25;
    if (R.headHit || pit || dry > 1.6 || stuck) {
      if (R.headHit) why.head++; else if (pit) why.pit++; else if (dry > 1.6) why.fuel++; else if (Math.cos(R.a) < 0) why.flipped++; else why.stuck++;
      crashes++; tries++;
      if (tries > 8) { stuckAt = Math.round(R.x); break; }
      place(); lastProgress = R.x; lastProgressT = t;
    }
    if (R.x > tr.finish) return { n, ok: true, t, crashes, nan, len: tr.finish, world: tr.world.id, d: tr.plan.difficulty, why };
  }
  return { n, ok: false, t, crashes, nan, stuckAt, len: tr.finish, world: tr.world.id, d: tr.plan.difficulty, x: Math.round(R.x), why };
}

const rows = [];
for (let n = Number(from); n <= Number(to); n += Number(step)) {
  const r = drive(n);
  rows.push(r);
  console.log(`${String(n).padStart(4)} ${r.world.padEnd(8)} d=${r.d.toFixed(2)} len=${r.len}  ${r.ok ? "finished" : `NOT FINISHED (stuck at ${r.stuckAt ?? r.x} m)`}  ${r.t.toFixed(0)}s  crashes=${r.crashes}${r.crashes ? " " + JSON.stringify(Object.fromEntries(Object.entries(r.why).filter(([, v]) => v))) : ""}${r.nan ? "  NaN!" : ""}`);
}
const ok = rows.filter((r) => r.ok).length;
console.log(`\n${ok}/${rows.length} finished by the bot (${vid}, upgrades ${L}); average crashes ${(rows.reduce((s, r) => s + r.crashes, 0) / rows.length).toFixed(1)}`);
