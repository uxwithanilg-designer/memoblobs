// Wake Racers QA: the test driver (src/wake/ai.ts, with item hunting on) races stages with the real rules and physics
// (no browser) and reports whether each event can be won, the place, the time, coins, hearts lost and why it failed.
//   node scripts/wake_sweep.mjs [from] [to] [step]           e.g. node scripts/wake_sweep.mjs 1 600 7
//   BOAT=minnow LEVEL=0 node scripts/wake_sweep.mjs 1 600 13  (which boat, and its upgrade level 0-5)
//   SKILL=0.6 node scripts/wake_sweep.mjs 1 600 13            (a less careful driver)
//   TRIES=3 …                                                  (retries per stage, like a player would)
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const MODS = ["util", "worlds", "stages", "boats", "course", "physics", "ai", "race"];
const tmp = mkdtempSync(join(tmpdir(), "wake-"));
for (const m of MODS) {
  const js = ts.transpileModule(readFileSync(`src/wake/${m}.ts`, "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    .replace(/from "\.\/([\w-]+)"/g, 'from "./$1.mjs"');
  writeFileSync(join(tmp, `${m}.mjs`), js);
}
const imp = (m) => import(pathToFileURL(join(tmp, `${m}.mjs`)).href);
const { stagePlan } = await imp("stages");
const { buildCourse } = await imp("course");
const { newInput } = await imp("physics");
const { Driver } = await imp("ai");
const { Race } = await imp("race");
const { worldOf } = await imp("worlds");
rmSync(tmp, { recursive: true, force: true });

const [from = 1, to = 30, step = 1] = process.argv.slice(2).map(Number);
const BOAT = process.env.BOAT ?? "minnow";
const LEVEL = Number(process.env.LEVEL ?? 0);
const SKILL = Number(process.env.SKILL ?? 0.92);
const TRIES = Number(process.env.TRIES ?? 3);

function run(n, attempt) {
  const plan = stagePlan(n);
  const t0 = performance.now();
  const c = buildCourse(plan);
  const build = performance.now() - t0;
  const w = worldOf(plan.world);
  const race = new Race(c, { boat: BOAT, levels: { engine: LEVEL, handling: LEVEL, nitro: LEVEL }, paint: "stock", mode: plan.mode, need: plan.need, rivals: plan.rivals, pace: plan.pace, skill: plan.skill, twist: plan.twist, d: plan.d, bossBoat: w.boss.boat, bossName: w.boss.name });
  const bot = new Driver(SKILL, 0);
  bot.collector = process.env.COLLECT !== "0";
  bot.dock = c.dock;
  const inp = newInput();
  race.start();
  let t = 0, slow = 0, vsum = 0, vn = 0;
  const ev = {};
  let continues = 0;
  while (t < 3600) {
    // a wreck, an empty tank or the clock: continue from the last checkpoint, like a player would (up to 4 times)
    if (race.result) {
      if (!race.result.ok && race.lastSnap && continues < Number(process.env.CONT ?? 4) && /wrecked|oil|Time/.test(race.result.reason)) { race.continueFrom(race.lastSnap); continues++; }
      else break;
    }
    if (race.phase !== "race") { race.update(1 / 60, inp); t += 1 / 60; continue; }
    bot.drive(c, race.player.boat, inp, { fuel01: race.fuel / race.tank, hearts: race.hearts, nitro: race.player.nitro, hasPower: !!race.power }, 1 / 60, race.t);
    if (race.phase === "race" && race.power) race.usePower();
    if (!Number.isFinite(race.player.boat.x + race.player.boat.z + race.player.boat.y)) return { plan, c, ok: false, reason: "NaN", build, t };
    race.update(1 / 60, inp);
    for (const e of race.events) if (["hit", "wall", "bump", "mine", "land", "pad", "box", "fuel", "nearMiss"].includes(e.k)) { const key = e.k === "bump" || e.k === "hit" ? e.k + ":" + e.s : e.k; ev[key] = (ev[key] ?? 0) + 1; }
    race.events.length = 0;
    t += 1 / 60;
    if (race.phase === "race") {
      vsum += race.player.boat.fwd; vn++; if (race.player.boat.fwd < 14) slow += 1 / 60;
      const pb = race.player.boat;
      ev.thrLow = (ev.thrLow ?? 0) + (inp.throttle < 0.9 ? 1 / 60 : 0); ev.brk = (ev.brk ?? 0) + (inp.brake > 0 ? 1 / 60 : 0);
      ev.air = (ev.air ?? 0) + (!pb.grounded ? 1 / 60 : 0); ev.boost = (ev.boost ?? 0) + (pb.boostT > 0 ? 1 / 60 : 0);
      ev.latAvg = (ev.latAvg ?? 0) + Math.abs(pb.lat) / 60;
    }
    if (process.env.TRACE && Math.round(t * 60) % Number(process.env.TRACE) === 0) { const b = race.player.boat; console.log(`  t=${t.toFixed(1)} s=${b.s.toFixed(0)} d=${b.d.toFixed(1)} hw=${(c.hw[Math.round(b.i)]).toFixed(1)} v=${b.fwd.toFixed(1)} lat=${b.lat.toFixed(1)} y=${b.y.toFixed(1)} gr=${b.grounded} fuel=${race.fuel.toFixed(0)} thr=${inp.throttle} br=${inp.brake.toFixed(1)} st=${inp.steer.toFixed(2)} place=${race.player.place} ${race.power ?? ''}`); }

  }
  const r = race.result ?? { ok: false, reason: "timeout", place: race.player.place, time: t, coins: race.coins, coinsTotal: race.coinsTotal, heartsLost: race.heartsLost };
  return { plan, c, ...r, build, t, attempt, avg: vsum / Math.max(1, vn), slow, ev, continues };
}

const rows = [];
for (let n = from; n <= to; n += step) {
  let r = null;
  for (let a = 0; a < TRIES; a++) { r = run(n, a); if (r.ok) break; }
  rows.push(r);
  const p = r.plan;
  console.log(`${String(n).padStart(4)} ${p.world.padEnd(8)} ${p.mode.padEnd(9)} d=${p.d.toFixed(2)} need=${p.need} len=${Math.round(r.c.length)} obst=${r.c.obstacles.length} items=${r.c.items.length} build=${r.build.toFixed(0)}ms  ${r.ok ? "WON " : "FAIL"} place=${r.place}/${r.of ?? "?"} t=${(r.time ?? r.t).toFixed(1)}s coins=${r.coins}/${r.coinsTotal} hurt=${r.heartsLost} cont=${r.continues ?? 0} avg=${(r.avg ?? 0).toFixed(1)} slow=${(r.slow ?? 0).toFixed(0)}s ${JSON.stringify(Object.fromEntries(Object.entries(r.ev ?? {}).map(([k, v]) => [k, Math.round(v * 10) / 10])))}${r.ok ? "" : "  " + r.reason}${r.attempt ? ` (try ${r.attempt + 1})` : ""}`);
}
const won = rows.filter((r) => r.ok).length;
console.log(`\n${BOAT} L${LEVEL} skill ${SKILL}: ${won}/${rows.length} won`);
