// Momo Boing! balance sweep: the bot plays every open stage and prints win rate, stars, time and why it lost.
//   node scripts/boing_sweep.mjs [runs=3] [skill=1] [from=1] [to=30]
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const runs = Number(process.argv[2] ?? 3), skill = Number(process.argv[3] ?? 1);
const from = Number(process.argv[4] ?? 1), to = Number(process.argv[5] ?? 30);
const src = join(import.meta.dirname, "..", "src", "boing");
const dir = mkdtempSync(join(tmpdir(), "boing-"));
for (const f of ["types", "levels", "sim"]) writeFileSync(join(dir, `${f}.ts`), readFileSync(join(src, `${f}.ts`), "utf8").replace(/from "\.\/(\w+)"/g, 'from "./$1.ts"'));
const { stageDef, buildStage } = await import(pathToFileURL(join(dir, "levels.ts")).href);
const { Sim } = await import(pathToFileURL(join(dir, "sim.ts")).href);

function play(spec) {
  const s = new Sim(spec, { bot: true, skill });
  let why = "";
  while (s.phase === "play" && s.t < 400) {
    s.step(1 / 60);
    for (const e of s.events) if (e.t === "hit") why = e.by;
    s.events.length = 0;
  }
  return { ...s.result(), why: s.phase === "lost" ? why : s.phase === "play" ? "timeout" : "" };
}
console.log(`runs=${runs} skill=${skill}`);
console.log("stage  type      d     top  won  stars  time  height  perf  chain comets friends bumps  lost-by   goal");
let W = 0, N = 0;
for (let n = from; n <= to; n++) {
  const def = stageDef(n), spec = buildStage(def);
  const rs = Array.from({ length: runs }, () => play(buildStage(def)));
  const won = rs.filter((r) => r.won).length, avg = (k) => rs.reduce((a, r) => a + r[k], 0) / rs.length;
  W += won; N += runs;
  console.log(`${String(n).padStart(4)}   ${def.type.padEnd(8)} ${spec.d.toFixed(2)}  ${String(spec.top).padStart(4)}  ${won}/${runs}  ${rs.map((r) => r.stars).join("").padEnd(5)} ${avg("time").toFixed(0).padStart(4)}s  ${avg("height").toFixed(0).padStart(5)}  ${avg("perfects").toFixed(0).padStart(4)}  ${avg("bestChain").toFixed(0).padStart(4)}  ${avg("comets").toFixed(1).padStart(4)}  ${avg("friends").toFixed(1).padStart(5)}  ${avg("bumps").toFixed(1).padStart(5)}  ${rs.map((r) => r.why || "-").join(",").padEnd(9)} ${spec.goal.text}`);
}
console.log(`total ${W}/${N}`);
