// Gizmo Drive QA: the test driver (src/gizmo/bot.ts) drives stages with the real physics (no browser) and reports
// whether each can be finished, how long it takes, how many tries it costs, and anything broken (NaN, getting stuck,
// running dry). With BOT=careless it drives full gas everywhere, like a player with no skill: that should fail.
//   node scripts/gizmo_sweep.mjs [from] [to] [step]          e.g. node scripts/gizmo_sweep.mjs 1 600 7
//   BOT=careless node scripts/gizmo_sweep.mjs 1 600 7
//   BOT=clumsy node scripts/gizmo_sweep.mjs 1 600 19          (a casual player: late on the pedals, hands off in the air)
//   TRACE=x0-x1 node scripts/gizmo_sweep.mjs 12 12            (log the car between those metres)
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const MODS = ["util", "worlds", "stages", "vehicles", "physics", "course", "bot"];
const tmp = mkdtempSync(join(tmpdir(), "gizmo-"));
for (const m of MODS) {
  const js = ts.transpileModule(readFileSync(`src/gizmo/${m}.ts`, "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    .replace(/from "\.\/([\w-]+)"/g, 'from "./$1.mjs"');
  writeFileSync(join(tmp, `${m}.mjs`), js);
}
const imp = (m) => import(pathToFileURL(join(tmp, `${m}.mjs`)).href);
const { buildCourse } = await imp("course");
const { Car, STEP } = await imp("physics");
const { Bot } = await imp("bot");
rmSync(tmp, { recursive: true, force: true });

const [from = 1, to = 30, step = 1] = process.argv.slice(2).map(Number);
const BOT = process.env.BOT ?? "careful";
const TRACE = process.env.TRACE ? process.env.TRACE.split("-").map(Number) : null;
const MAX_TRIES = Number(process.env.TRIES ?? 10);

function drive(n) {
  const c = buildCourse(n);
  const W = c.physics, v = c.vehicle;
  const car = new Car(v);
  const bot = new Bot(c);
  bot.careless = BOT === "careless";
  const ground = (x) => W.groundAt(x, 1e9);
  let cp = 0, crashes = 0, t = 0, fuel = v.tank, dry = 0, roof = 0, tries = 0, nan = false;
  const why = {};
  const place = () => {
    W.reset();
    const p = cp > 0 ? c.checkpoints[cp - 1] : c.start;
    car.place(p.x, (x) => W.groundAt(x, p.y + 3));
    fuel = v.tank; dry = 0; roof = 0; bot.reset();
    for (const it of c.items) if (it.x > p.x) it.taken = false;
  };
  void ground;
  place();
  let best = car.x, bestT = 0;
  const p = { gas: 0, brake: 0 };
  // BOT=clumsy: a casual player — the careful plan, but a beat late, and hands off the pedals in the air
  const lag = [];
  while (t < 600) {
    bot.tries = tries;
    bot.drive(car, p);
    if (BOT === "clumsy") {
      lag.push(p.gas, p.brake);
      if (lag.length > 2 * 9) { p.gas = lag.shift(); p.brake = lag.shift(); } else { p.gas = 0; p.brake = 0; }
      if (!car.grounded) { p.gas = 0; p.brake = 0; }
    }
    if (fuel <= 0) p.gas = 0;
    for (let k = 0; k < 4; k++) W.step(car, p);
    t += STEP * 4;
    fuel -= (0.15 + 0.85 * p.gas) * STEP * 4;
    if (TRACE && car.x > TRACE[0] && car.x < TRACE[1] && Math.round(t * 60) % 10 === 0)
      console.log(`  t=${t.toFixed(2)} x=${car.x.toFixed(2)} y=${car.y.toFixed(2)} v=${car.forward.toFixed(1)} a=${(car.a * 57.3).toFixed(0)}° w=${car.w.toFixed(2)} gas=${p.gas} brake=${p.brake} air=${!car.grounded} touch=${car.touch[0]}${car.touch[1]} try=${tries}`);
    if (!Number.isFinite(car.x + car.y + car.a + car.wx[0] + car.wy[1])) { nan = true; break; }
    for (const it of c.items) { if (it.taken || Math.abs(it.x - car.x) > 2.5) continue; if (Math.hypot(it.x - car.x, it.y - car.y - 0.4) < 1.7) { it.taken = true; if (it.kind === "fuel") fuel = v.tank; } }
    if (cp < c.checkpoints.length && car.x > c.checkpoints[cp].x && car.grounded) { cp++; tries = 0; }
    const pit = c.pits.some((q) => car.x > q.x0 && car.x < q.x1 && car.y < q.kill);
    dry = fuel <= 0 && car.speed < 0.5 ? dry + STEP * 4 : 0;
    roof = Math.cos(car.a) < -0.3 && car.speed < 0.6 ? roof + STEP * 4 : 0;
    if (car.x > best + 2) { best = car.x; bestT = t; }
    const stuck = t - bestT > 25;
    let k = null;
    if (car.headHit) k = "head"; else if (pit || car.y < W.killY) k = "fall"; else if (dry > 1.6) k = "fuel"; else if (roof > 1.2) k = "roof"; else if (stuck) k = "stuck";
    if (k) {
      why[`${k}@${Math.round(car.x)}`] = (why[`${k}@${Math.round(car.x)}`] ?? 0) + 1;
      crashes++; tries++;
      if (tries > MAX_TRIES) return { n, c, ok: false, t, crashes, nan, why, x: Math.round(car.x) };
      place(); best = car.x; bestT = t;
    }
    if (car.x > c.finish.x) return { n, c, ok: true, t, crashes, nan, why };
  }
  return { n, c, ok: false, t, crashes, nan, why, x: Math.round(car.x) };
}

const rows = [];
for (let n = from; n <= to; n += step) {
  const r = drive(n);
  rows.push(r);
  const pl = r.c.plan;
  if (process.env.SPANS && !r.ok) console.log("   " + r.c.modules.map((m) => `${m.k}@${Math.round(m.x0)}-${Math.round(m.x1)}`).join(" "));
  console.log(`${String(n).padStart(4)} ${pl.world.padEnd(9)} ${pl.vehicle.padEnd(7)} d=${pl.difficulty.toFixed(2)} len=${Math.round(r.c.finish.x)} [${pl.modules.join(",")}]  ${r.ok ? "finished" : `NOT FINISHED (at ${r.x} m)`}  ${r.t.toFixed(0)}s crashes=${r.crashes}${r.crashes ? " " + JSON.stringify(r.why) : ""}${r.nan ? "  NaN!" : ""}`);
}
const ok = rows.filter((r) => r.ok).length;
const clean = rows.filter((r) => r.ok && r.crashes === 0).length;
console.log(`\n${BOT}: ${ok}/${rows.length} finished, ${clean} with no crash; average crashes ${(rows.reduce((s, r) => s + r.crashes, 0) / rows.length).toFixed(1)}`);
