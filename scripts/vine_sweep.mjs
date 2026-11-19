// Tondu's Vine Climb: play every stage with bots that have human reaction times (good 0.18 s, average 0.25 s,
// slow 0.40 s) and report clears, hits and close calls per stage and per world.
//   node scripts/vine_sweep.mjs [from=1] [to=100] [--skills=good,avg,slow] [--runs=1] [--quiet]
// Node 22.6+ runs the TypeScript directly (type stripping).
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const nums = args.filter((a) => !a.startsWith("--")).map(Number);
const from = nums[0] ?? 1, to = nums[1] ?? 100;
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) ?? `=${d}`).split("=")[1];
const skills = opt("skills", "good,avg,slow").split(",");
const runs = Number(opt("runs", 1));
const quiet = args.includes("--quiet");
const src = join(import.meta.dirname, "..", "src", "vine");
const dir = mkdtempSync(join(tmpdir(), "vine-"));
for (const f of ["types", "path", "worlds", "stages", "sim", "bot"]) {
  writeFileSync(join(dir, `${f}.ts`), readFileSync(join(src, `${f}.ts`), "utf8").replace(/from "\.\/(\w+)"/g, 'from "./$1.ts"'));
}
const imp = (f) => import(pathToFileURL(join(dir, `${f}.ts`)).href);
const { stageDef, buildStage } = await imp("stages");
const { Sim } = await imp("sim");
const { Bot, SKILLS, botRun } = await imp("bot");
const { mulberry } = await imp("path");

const perWorld = new Map();
const bad = [];
const t0 = performance.now();
for (let n = from; n <= to; n++) {
  const def = stageDef(n);
  const tb = performance.now();
  const st = buildStage(def);
  const tBuild = performance.now() - tb;
  const res = {};
  for (const k of skills) {
    let clear = 0, hits = 0, falls = [];
    for (let r = 0; r < runs; r++) {
      const out = botRun(new Sim(st), new Bot(SKILLS[k], mulberry(n * 31 + r * 7 + k.length)));
      if (out.clear) clear++; else falls.push(`${out.why}@${Math.round(out.s)}`);
      hits += out.hits;
    }
    res[k] = { clear: clear / runs, hits: hits / runs, falls };
  }
  const w = def.world + 1;
  const pw = perWorld.get(w) ?? { n: 0, good: 0, avg: 0, slow: 0, hits: 0, haz: 0, len: 0, v: 0 };
  pw.n++; pw.haz += st.haz.length; pw.len += st.path.len; pw.v += def.speed;
  for (const k of skills) pw[k] += res[k].clear;
  pw.hits += res.avg?.hits ?? 0;
  perWorld.set(w, pw);
  if (skills.includes("good") && res.good.clear < 1) bad.push(n);
  if (!quiet) console.log(`${String(n).padStart(3)} W${String(w).padStart(2)}-${String(def.k).padStart(2)} ${def.kind.padEnd(6)} v=${def.speed.toFixed(1)} win=${def.win.toFixed(2)} len=${Math.round(st.path.len)} haz=${st.haz.length} gaps=${st.gaps.length} bugs=${st.bugs.length} [${def.concepts.join(",")}] ` +
    skills.map((k) => `${k}:${res[k].clear ? "OK" : "x"}${res[k].hits ? `(${res[k].hits}h)` : ""}${res[k].falls.length ? " " + res[k].falls.join(" ") : ""}`).join("  ") + `  ${tBuild.toFixed(0)}ms`);
}
for (const [w, p] of perWorld) {
  console.log(`World ${w}: ${p.n} stages · avg len ${Math.round(p.len / p.n)} m · speed ${(p.v / p.n).toFixed(1)} · hazards ${Math.round(p.haz / p.n)} · clears ${skills.map((k) => `${k} ${Math.round((p[k] / p.n) * 100)}%`).join(" · ")} · avg-bot hits ${(p.hits / p.n).toFixed(1)}`);
}
console.log(bad.length ? `GOOD BOT FAILED: ${bad.join(" ")}` : "the good bot clears every stage");
console.log(`done in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
