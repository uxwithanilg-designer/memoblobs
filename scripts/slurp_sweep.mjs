// Slurp Lab: check the forged campaign. For every stage in public/games/slurp-lab/stages-<k>.json it replays the
// planted solution with the real rules (it must clear the tray), and prints the curve: board, colours, Slurpers,
// Gloopies, par, order depth, trap rate and score, plus a per-lab summary.
//   node scripts/slurp_sweep.mjs [from=1] [to=100]
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const from = Number(process.argv[2] ?? 1), to = Number(process.argv[3] ?? 100);
const src = join(import.meta.dirname, "..", "src", "slurp");
const dir = mkdtempSync(join(tmpdir(), "slurp-"));
for (const f of ["types", "shapes", "rules", "solver", "grader", "generator", "campaign", "stagefile"]) {
  writeFileSync(join(dir, `${f}.ts`), readFileSync(join(src, `${f}.ts`), "utf8").replace(/from "\.\/(\w+)"/g, 'from "./$1.ts"'));
}
const { decodeStage } = await import(pathToFileURL(join(dir, "stagefile.ts")).href);
const { initState } = await import(pathToFileURL(join(dir, "rules.ts")).href);
const { verify } = await import(pathToFileURL(join(dir, "solver.ts")).href);

const files = new Map();
let bad = 0;
const labs = new Map();
for (let n = from; n <= to; n++) {
  const k = Math.floor((n - 1) / 100) + 1;
  if (!files.has(k)) files.set(k, JSON.parse(readFileSync(join(import.meta.dirname, "..", "public", "games", "slurp-lab", `stages-${k}.json`), "utf8")));
  const row = files.get(k)[(n - 1) % 100];
  if (!row) { console.log(`${n}: missing`); bad++; continue; }
  const st = decodeStage(row);
  const ok = verify(st, initState(st), st.solution);
  if (!ok) bad++;
  const blobs = st.blobs.filter((b) => b >= 0).length;
  const L = labs.get(st.lab) ?? { n: 0, score: 0, par: 0, trap: 0, max: 0 };
  L.n++; L.score += st.m.score; L.par += st.m.par; L.trap += st.m.trap; L.max = Math.max(L.max, st.m.score); labs.set(st.lab, L);
  console.log(`${String(n).padStart(3)} ${ok ? "ok " : "BAD"} L${st.lab}-${String(st.s).padStart(2)} ${st.w}x${st.h} col=${st.colors} sl=${st.slurpers.length} blobs=${blobs} par=${st.m.par} depth=${st.m.depth} trap=${st.m.trap} score=${st.m.score}  ${st.name}`);
}
for (const [lab, L] of labs) console.log(`Lab ${lab}: ${L.n} stages · avg par ${(L.par / L.n).toFixed(1)} · avg trap ${(L.trap / L.n).toFixed(2)} · avg score ${(L.score / L.n).toFixed(1)} · max ${L.max}`);
console.log(bad ? `${bad} stage(s) FAILED` : "every planted solution clears its tray");
process.exit(bad ? 1 : 0);
