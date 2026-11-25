// Tumble Truck QA: a bot drives stages with the real physics (no browser) and reports whether each delivery can be
// made, how much of the load arrives (and how much had to), the stars, the crashes and anything broken (NaN, getting
// stuck, running dry).
//   node scripts/haul_sweep.mjs [from] [to] [step] [truck] [upgrade level]   e.g. node scripts/haul_sweep.mjs 1 600 25 mudbug
//   BOT=naive node scripts/haul_sweep.mjs ...   (full gas everywhere: a careless player — it should fail)
//   TRACE=x0-x1 logs the truck between those metres.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const MODS = ["util", "worlds", "cargo", "stages", "terrain", "physics", "trucks"];
const tmp = mkdtempSync(join(tmpdir(), "haul-"));
for (const m of MODS) {
  const js = ts.transpileModule(readFileSync(`src/haul/${m}.ts`, "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    .replace(/from "\.\/([\w-]+)"/g, 'from "./$1.mjs"');
  writeFileSync(join(tmp, `${m}.mjs`), js);
}
const imp = (m) => import(pathToFileURL(join(tmp, `${m}.mjs`)).href);
const { buildCourse } = await imp("terrain");
const { Truck, STEP, ABOARD } = await imp("physics");
const { tuned, truckOf, NO_UPGRADES, bedLength } = await imp("trucks");
const { stackLoad } = await imp("cargo");
rmSync(tmp, { recursive: true, force: true });

const [from = 1, to = 60, step = 1, tid = "mudbug", lvl = "0"] = process.argv.slice(2);
const BOT = process.env.BOT ?? "careful";
const TRACE = process.env.TRACE ? process.env.TRACE.split("-").map(Number) : null;
const QUIET = !!process.env.QUIET;
const L = Number(lvl);
const levels = { engine: L, suspension: L, tires: L, tank: L, padding: L };

function drive(n, steady = false) {
  const tr = buildCourse(n), T = tr.terrain, plan = tr.plan;
  const spec = tuned(truckOf(tid), L ? levels : NO_UPGRADES);
  const R = new Truck(spec);
  R.gravity = tr.gravity; R.gripMul = tr.world.grip; R.toughness = spec.padding;
  let cp = 0, crashes = 0, t = 0, fuel = spec.fuel, dry = 0, nan = false, stuckAt = -1, tries = 0, carry = plan.count, upside = 0, lives = 3;
  const why = { roof: 0, pit: 0, fuel: 0, stuck: 0, cargo: 0 };
  const place = () => {
    R.place(T, cp > 0 ? tr.checkpoints[cp - 1] + 2 : 2);
    R.loadCargo(stackLoad(plan.cargo, carry, bedLength(spec), plan.seed + cp));
    fuel = spec.fuel; dry = 0; upside = 0;
  };
  place();
  // let the load settle before GO (the game does the same during its fly-in)
  for (let k = 0; k < 240; k++) R.step(T, { gas: 0, brake: 0 });
  const items = tr.items.map((i) => ({ ...i }));
  let lastProgress = 0, lastProgressT = 0;
  const p = { gas: 0, brake: 0 };
  let minAboard = plan.count;
  while (t < 4000) {
    // the ground ahead (at a crawl: the ground under the truck, or a ledge ahead looks like a wheelie)
    const slopeA = R.speed < 4 && R.grounded ? Math.atan2(R.wy[1] - R.wy[0], R.wx[1] - R.wx[0]) : Math.atan(T.slopeAt(R.x + Math.max(2, R.vx * 0.5)));
    const rel = R.a - slopeA;
    // wind (gusting)
    let wind = 0;
    for (const w of tr.winds) if (R.x > w.x0 && R.x < w.x1) wind = w.s * (0.65 + 0.35 * Math.sin(t * 1.4 + w.x0));
    R.wind = wind;
    if (BOT === "naive") { p.gas = 1; p.brake = 0; }
    else if (steady && R.grounded) {
      // the steady driver: one gentle speed everywhere (gaps get their run-up), full power only to climb
      const pitAhead = tr.pits.find((pp) => pp.x0 - R.x > 0 && pp.x0 - R.x < 45);
      const cap = pitAhead ? 11.5 : 3.8;
      // a gentle start (the gas tapped) unless it has to climb
      const tap = Math.abs(T.slopeAt(R.x + 2)) < 0.15 && !pitAhead ? (t * 5) % 1 < 0.5 : true;
      p.gas = R.forward < cap && tap ? 1 : 0; p.brake = R.forward > cap + 0.6 ? 0.45 : 0;
      if (rel > 0.5) p.gas = 0.3;
    }
    else if (R.grounded) {
      p.gas = rel > 0.45 ? 0 : 1; p.brake = rel > 0.8 ? 0.6 : 0;
      // the careful driver reads the road ahead: rough ground, crests, logs, steps → slow; jumps → the speed they need
      let rough = 0, crest = 0;
      for (let q = 1; q < 24; q += 1) {
        const xq = R.x + q;
        if (tr.pits.some((pp) => xq > pp.x0 - 45 && xq < pp.x1 + 15)) continue;
        rough = Math.max(rough, Math.abs(T.slopeAt(xq) - T.slopeAt(xq - 1)));
      }
      for (let q = 2; q < 16; q += 1) crest = Math.max(crest, T.slopeAt(R.x + 1) - T.slopeAt(R.x + q));
      // a load stacked above the side boards is driven slower everywhere
      const ca0 = Math.cos(R.a), sa0 = Math.sin(R.a), rim = spec.bed.y + spec.bed.wall;
      const stacked = R.cargo.some((c) => c.state === ABOARD && -(c.x - R.x) * sa0 + (c.y - R.y) * ca0 + c.hh > rim + 0.05);
      const heavyLoad = (R.cargo.length > 5 ? 0.85 : 1) * (stacked ? 0.8 : 1);
      let cap = (rough > 0.4 ? 3.6 : rough > 0.25 ? 5 : rough > 0.14 ? 7 : 11) * heavyLoad;
      if (crest > 0.3) cap = Math.min(cap, (R.gravity < 7 ? 4 : 6) * heavyLoad);
      if (T.zoneAt(R.x + 4) === 2) cap = Math.min(cap, 6);
      // a steep climb ahead (the "steep" sign): slow, so the stack doesn't slide back off
      let climb = 0;
      for (let q = 2; q < 26; q += 2) climb = Math.max(climb, T.slopeAt(R.x + q));
      if (climb > 0.32 && R.cargo.length > 2) cap = Math.min(cap, 4.5);
      // in a gust, slow down (driving into the wind makes it push harder)
      if (tr.winds.some((w) => R.x > w.x0 - 5 && R.x < w.x1)) cap = Math.min(cap, 4.5);
      const pitAhead = tr.pits.find((pp) => pp.x0 - R.x > 0 && pp.x0 - R.x < 45);
      if (pitAhead) cap = 11.5;
      if (tries % 2 === 1 && !pitAhead) cap *= 0.75;
      // after a few failed tries, like a player, it slows right down: slow and steady (gaps still need their speed)
      if (tries >= 4 && !pitAhead) cap = Math.min(cap, 4.5);
      // a tall or fragile load gets a gentle start: the gas pedal is tapped (phones and keys are on / off)
      const ca = Math.cos(R.a), sa = Math.sin(R.a), floor = spec.bed.y + spec.bed.wall;
      const tall = R.cargo.some((c) => c.state === ABOARD && -(c.x - R.x) * sa + (c.y - R.y) * ca + c.hh > floor + 0.05);
      if (p.gas > 0 && R.forward < (R.gravity < 7 ? 99 : 6) && tall && Math.abs(T.slopeAt(R.x + 2)) < 0.15 && (t * 5) % 1 > (R.gravity < 7 ? 0.4 : 0.55)) p.gas = 0;
      if (R.forward > cap) { p.gas = 0; p.brake = R.forward > cap + 2.5 ? 0.5 : 0.15; }
      else if (R.forward > cap - 1.5) p.gas = Math.min(p.gas, 0.4);
    } else {
      const want = -3 * rel, err = R.w - want;
      p.gas = err < -0.25 ? 1 : 0; p.brake = err > 0.25 ? 1 : 0;
    }
    if (fuel <= 0) p.gas = 0;
    for (let k = 0; k < 4; k++) R.step(T, p);
    t += STEP * 4;
    if (TRACE && R.x > TRACE[0] && R.x < TRACE[1] && Math.round(t * 60) % 15 === 0) console.log(`  t=${t.toFixed(2)} x=${R.x.toFixed(1)} v=${R.forward.toFixed(1)} a=${(R.a * 57.3).toFixed(0)}° gas=${p.gas} brake=${p.brake} air=${!R.grounded} aboard=${R.aboard}`);
    fuel -= spec.fuelUse * (0.12 + 0.88 * p.gas) * STEP * 4;
    if (!Number.isFinite(R.x + R.y + R.a)) { nan = true; break; }
    for (const it of items) { if (it.taken || Math.abs(it.x - R.x) > 2.5) continue; if (Math.hypot(it.x - R.x, it.y - R.y - 0.6) < 1.9) { it.taken = true; if (it.kind === "fuel") fuel = spec.fuel; } }
    const aboard = R.aboard;
    minAboard = Math.min(minAboard, aboard);
    if (cp < tr.checkpoints.length && R.x > tr.checkpoints[cp]) { cp++; tries = 0; carry = aboard; }
    const pit = tr.pits.some((q) => R.x > q.x0 && R.x < q.x1 && R.y < T.heightAt(q.x0) - 5);
    dry = fuel <= 0 && R.speed < 0.5 ? dry + STEP * 4 : 0;
    upside = Math.cos(R.a) < -0.1 && R.speed < 1 ? upside + STEP * 4 : 0;
    if (R.x > lastProgress + 3) { lastProgress = R.x; lastProgressT = t; }
    const stuck = t - lastProgressT > 25;
    const short = aboard < plan.need;
    if (R.roofHit || pit || dry > 1.6 || stuck || short || upside > 1.5) {
      if (R.roofHit || upside > 1.5) why.roof++; else if (pit) why.pit++; else if (short) why.cargo++; else if (dry > 1.6) why.fuel++; else why.stuck++;
      crashes++; tries++; lives--;
      if (tries > 8 || crashes > 20) { stuckAt = Math.round(R.x); break; }
      // as in the game: out of lives, the delivery starts again from the start with the whole load
      if (lives <= 0) { lives = 3; cp = 0; carry = plan.count; }
      place(); lastProgress = R.x; lastProgressT = t;
    }
    if (R.x > tr.finish + 2) {
      const got = R.aboard, stars = got >= plan.count ? 3 : got >= Math.ceil(plan.count * 0.8) ? 2 : 1;
      return { n, ok: true, t, crashes, nan, len: tr.finish, world: tr.world.id, d: plan.difficulty, why, got, count: plan.count, need: plan.need, stars, cargo: plan.cargo.join("+") };
    }
  }
  return { n, ok: false, t, crashes, nan, stuckAt, len: tr.finish, world: tr.world.id, d: plan.difficulty, x: Math.round(R.x), why, got: 0, count: plan.count, need: plan.need, stars: 0, cargo: plan.cargo.join("+") };
}

const rows = [];
for (let n = Number(from); n <= Number(to); n += Number(step)) {
  let r = drive(n, !!process.env.STEADY);
  // a careful player who keeps failing tries a different way: one steady, gentle speed all the way
  if (!r.ok && BOT !== "naive") { const s2 = drive(n, true); if (s2.ok) r = { ...s2, steady: true }; }
  rows.push(r);
  if (!QUIET || !r.ok) console.log(`${String(n).padStart(4)} ${r.world.padEnd(8)} ${r.cargo.padEnd(12)} d=${r.d.toFixed(2)} len=${r.len}  ${r.ok ? `delivered ${r.got}/${r.count} (need ${r.need}) ${"★".repeat(r.stars)}${r.steady ? " (steady driver)" : ""}` : `NOT DELIVERED (stuck at ${r.stuckAt ?? r.x} m)`}  ${r.t.toFixed(0)}s  fails=${r.crashes}${r.crashes ? " " + JSON.stringify(Object.fromEntries(Object.entries(r.why).filter(([, v]) => v))) : ""}${r.nan ? "  NaN!" : ""}`);
}
const ok = rows.filter((r) => r.ok);
const clean = rows.filter((r) => r.ok && r.crashes === 0).length;
const steadyN = rows.filter((r) => r.steady).length;
console.log(`\n${BOT}: ${ok.length}/${rows.length} delivered${steadyN ? ` (${steadyN} by the steady driver)` : ""} (${tid}, upgrades ${L}); first-try ${clean}; average fails ${(rows.reduce((s, r) => s + r.crashes, 0) / rows.length).toFixed(1)}; stars ${(ok.reduce((s, r) => s + r.stars, 0) / Math.max(1, ok.length)).toFixed(2)}`);
