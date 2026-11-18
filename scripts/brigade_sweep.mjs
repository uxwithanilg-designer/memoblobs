// Blob Brigade par-bot balance sweep: plays every campaign stage (and an Endless run) with the built-in bot and
// prints win / stars / brigade size / time. Node 22.6+ runs the TypeScript sim directly (type stripping).
//   node scripts/brigade_sweep.mjs [math=plus|easy|off] [runs=3]
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const math = process.argv[2] ?? "plus";
const runs = Number(process.argv[3] ?? 3);
const skill = Number(process.argv[4] ?? 1);
const src = join(import.meta.dirname, "..", "src", "crowd");
const dir = mkdtempSync(join(tmpdir(), "brigade-"));
for (const f of ["types", "levels", "sim", "leaders"]) {
  const code = readFileSync(join(src, `${f}.ts`), "utf8").replace(/from "\.\/(\w+)"/g, 'from "./$1.ts"');
  writeFileSync(join(dir, `${f}.ts`), code);
}
const { STAGES, buildStage, endlessSpec, remixSpec, dailySpec, dailyInfo, rushSpec } = await import(pathToFileURL(join(dir, "levels.ts")).href);
if (process.env.PRESSURE) (await import(pathToFileURL(join(dir, "levels.ts")).href)).setPressure(Number(process.env.PRESSURE));
const { Sim } = await import(pathToFileURL(join(dir, "sim.ts")).href);
if (process.env.EXPECT) (await import(pathToFileURL(join(dir, "sim.ts")).href)).setExpectShare(Number(process.env.EXPECT));
if (process.env.ADAPT) (await import(pathToFileURL(join(dir, "sim.ts")).href)).setAdaptExp(Number(process.env.ADAPT));

function play(spec, maxT = 300) {
  // UP=1: the upgrades a player would have bought by this world (about one level per world)
  const L = process.env.UP ? Math.min(10, spec.world ?? 0) : 0;
  // HUMAN=1.3: a player who grabs more blobs than the bot (every blob tile and cage is worth that much more to them)
  const s = new Sim(spec, { bot: true, skill, greedy: !!process.env.GREEDY, collectMul: Number(process.env.HUMAN ?? 1), loadout: { leader: process.env.LEADER ?? "momo", up: { start: L, fire: L, power: L, charge: L, coins: 0 } } });
  const t0 = performance.now();
  let steps = 0;
  while (s.phase === "play" && s.t < maxT) { s.step(1 / 30); s.events.length = 0; steps++; }
  return { ...s.result(), lost: s.stats.lost, ms: (performance.now() - t0) / Math.max(1, steps) };
}

console.log(`math=${math} runs=${runs} skill=${skill}`);
// MODE=remix|daily|rush: the Phase 3 modes with late-game upgrades (UP_LEVEL, default 8)
if (process.env.MODE) {
  const LV = Number(process.env.UP_LEVEL ?? 8);
  const run = (spec, maxT = 400) => {
    const s = new Sim(spec, { bot: true, skill, greedy: !!process.env.GREEDY, loadout: { leader: process.env.LEADER ?? "momo", up: { start: LV, fire: LV, power: LV, charge: LV, coins: 0 } } });
    while (s.phase === "play" && s.t < maxT) { s.step(1 / 30); s.events.length = 0; }
    return s.result();
  };
  const fmt = (r) => `${r.won ? "W" : "L"}${r.stars} ${r.count}/${r.peak} ${Math.round(r.time)}s${r.wave != null ? ` bosses=${r.wave}` : ""}`;
  if (process.env.MODE === "remix") for (const n of [101, 103, 105, 107, 109, 115, 121, 135, 150, 199]) console.log("remix", n, Array.from({ length: runs }, () => fmt(run(remixSpec(n, math)))).join(" | "));
  if (process.env.MODE === "daily") for (let d = 1; d <= 10; d++) { const key = `2026-11-${String(d).padStart(2, "0")}`; const i = dailyInfo(key); console.log("daily", key, i.world, i.type, i.mod, Array.from({ length: runs }, () => fmt(run(dailySpec(key, math)))).join(" | ")); }
  if (process.env.MODE === "rush") console.log("rush", Array.from({ length: runs }, () => fmt(run(rushSpec(math), 900))).join(" | "));
  process.exit(0);
}
console.log("stage              type      won stars  final/peak   lost  time  ms/step  goal");
// FIRST=20: only the first N campaign stages (and no Endless run); FROM=20 skips the ones before
const FIRST = Number(process.env.FIRST ?? STAGES.length);
for (const def of STAGES.slice(Number(process.env.FROM ?? 0), FIRST)) {
  const rs = Array.from({ length: runs }, () => play(buildStage(def, math)));
  const won = rs.filter((r) => r.won).length, avg = (k) => rs.reduce((a, r) => a + r[k], 0) / rs.length;
  const spec = buildStage(def, math);
  console.log(`${def.id.padEnd(18)} ${def.type.padEnd(9)} ${won}/${runs}  ${rs.map((r) => r.stars).join("")}   ${String(Math.round(avg("count"))).padStart(5)}/${String(Math.round(avg("peak"))).padEnd(5)} ${String(Math.round(avg("lost"))).padStart(5)} ${avg("time").toFixed(0).padStart(5)}s  ${avg("ms").toFixed(2).padStart(6)}  ${spec.goal.text} [${rs.map((r) => (r.goalMet ? "y" : "n")).join("")}]`);
}
if (process.env.FIRST) process.exit(0);
const e = Array.from({ length: runs }, (_, i) => play(endlessSpec(1000 + i, math), 900));
console.log(`endless waves: ${e.map((r) => r.wave).join(", ")}  peak: ${e.map((r) => r.peak).join(", ")}  scores: ${e.map((r) => r.score).join(", ")}  time: ${e.map((r) => Math.round(r.time)).join(", ")}s  ms/step: ${e.map((r) => r.ms.toFixed(2)).join(", ")}`);
