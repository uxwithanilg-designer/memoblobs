// Momo Boing! stage 101+ trim: for one stage type, try a few trims over its stages in 101-200 and
// print the par + kid win share for each, so LATE_TRIM in levels.ts can be set.
//   node scripts/boing_tune_late.mjs <type> [runs=2]
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const type = process.argv[2], runs = Number(process.argv[3] ?? 2);
const src = join(import.meta.dirname, "..", "src", "boing");
const dir = mkdtempSync(join(tmpdir(), "boing-"));
for (const f of ["types", "levels", "sim"]) writeFileSync(join(dir, `${f}.ts`), readFileSync(join(src, `${f}.ts`), "utf8").replace(/from "\.\/(\w+)"/g, 'from "./$1.ts"'));
const { stageDef, buildStage, typeEase } = await import(pathToFileURL(join(dir, "levels.ts")).href);
const { Sim } = await import(pathToFileURL(join(dir, "sim.ts")).href);

const defs = [];
for (let n = 101; n <= 200; n++) { const d = stageDef(n); if (d.type === type) defs.push(d); }
const GRID = [0.5, 0.65, 0.8, 0.92, 1.05];
const out = [];
for (const m of GRID) {
  let w = 0, k = 0, wp = 0, wk = 0;
  for (const def of defs) for (const skill of [1, 0.3]) for (let i = 0; i < runs; i++) {
    const s = new Sim(buildStage(def, { ease: typeEase(type) * m }), { bot: true, skill });
    while (s.phase === "play" && s.t < 300) { s.step(1 / 60); s.events.length = 0; }
    const won = s.phase === "won" ? 1 : 0;
    w += won; k++; if (skill === 1) wp += won; else wk += won;
  }
  out.push(`${m.toFixed(2)}:${(w / k).toFixed(2)}(p${wp}/k${wk})`);
}
console.log(type.padEnd(8), `n=${defs.length}`, out.join("  "));
