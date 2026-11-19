// Slurp Lab: forge the campaign. For every stage it makes several "Plant and Prove" candidates, grades them (solver
// par, trap test, order chains, twins) and keeps the one the curve wants, then writes the stages in files of 100 to
// public/games/slurp-lab/stages-<k>.json (game files: they go to R2 with npm run upload:r2).
//   node scripts/slurp_forge.mjs [from=1] [to=100] [--dry]
// Node 22.6+ runs the TypeScript directly (type stripping).
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const nums = args.filter((a) => !a.startsWith("--")).map(Number);
const from = nums[0] ?? 1, to = nums[1] ?? 100;
const src = join(import.meta.dirname, "..", "src", "slurp");
const dir = mkdtempSync(join(tmpdir(), "slurp-"));
for (const f of ["types", "shapes", "rules", "solver", "grader", "generator", "campaign", "stagefile"]) {
  writeFileSync(join(dir, `${f}.ts`), readFileSync(join(src, `${f}.ts`), "utf8").replace(/from "\.\/(\w+)"/g, 'from "./$1.ts"'));
}
const { forge } = await import(pathToFileURL(join(dir, "generator.ts")).href);
const { recipeFor, stageName, kindOf } = await import(pathToFileURL(join(dir, "campaign.ts")).href);
const { encodeStage } = await import(pathToFileURL(join(dir, "stagefile.ts")).href);

const out = join(import.meta.dirname, "..", "public", "games", "slurp-lab");
mkdirSync(out, { recursive: true });
const files = new Map();
const t0 = performance.now();
for (let n = from; n <= to; n++) {
  const t1 = performance.now();
  const rc = recipeFor(n);
  const st = forge(rc);
  st.name = stageName(n);
  const k = Math.floor((n - 1) / 100) + 1;
  if (!files.has(k)) {
    const p = join(out, `stages-${k}.json`);
    files.set(k, existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : []);
  }
  const list = files.get(k);
  list[(n - 1) % 100] = encodeStage(st);
  const m = st.m;
  if (!dry) writeFileSync(join(out, `stages-${k}.json`), JSON.stringify(list)); // saved after every stage
  console.log(`${String(n).padStart(3)} L${rc.lab}-${String(rc.s).padStart(2)} ${(kindOf(n) ?? "").padEnd(8)} ${st.w}x${st.h} col=${st.colors} sl=${st.slurpers.length} blobs=${st.blobs.filter((b) => b >= 0).length} par=${m.par}/${m.planted} depth=${m.depth} trap=${m.trap} twins=${m.twins} score=${m.score}  ${Math.round(performance.now() - t1)}ms  ${st.name}`);
}
if (!dry) for (const [k, list] of files) writeFileSync(join(out, `stages-${k}.json`), JSON.stringify(list));
console.log(`done ${to - from + 1} stages in ${((performance.now() - t0) / 1000).toFixed(1)}s${dry ? " (dry run)" : ""}`);
