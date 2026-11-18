// Momo Boing! auto-balance: for every stage, finds the "ease" (a multiplier on every difficulty knob) at which the
// par bot and the careless-kid bot together win about the target share — high in the first worlds, lower later.
//   node scripts/boing_tune.mjs [from=1] [to=100] [runs=10]   → prints "n ease par kid" lines; paste into STAGE_EASE
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const from = Number(process.argv[2] ?? 1), to = Number(process.argv[3] ?? 100), runs = Number(process.argv[4] ?? 10);
const src = join(import.meta.dirname, "..", "src", "boing");
const dir = mkdtempSync(join(tmpdir(), "boing-tune-"));
for (const f of ["types", "levels", "sim"]) writeFileSync(join(dir, `${f}.ts`), readFileSync(join(src, `${f}.ts`), "utf8").replace(/from "\.\/(\w+)"/g, 'from "./$1.ts"'));
const { stageDef, buildStage } = await import(pathToFileURL(join(dir, "levels.ts")).href);
const { Sim } = await import(pathToFileURL(join(dir, "sim.ts")).href);

/** the share of runs (par and kid together) that should end at the golden cloud */
const target = (n) => { const f = Math.min(1, (n - 1) / 99); return 0.83 - 0.21 * f; };
const win = (def, ease, skill, k) => {
  let w = 0;
  for (let i = 0; i < k; i++) {
    const s = new Sim(buildStage(def, { ease }), { bot: true, skill });
    while (s.phase === "play" && s.t < 300) { s.step(1 / 60); s.events.length = 0; }
    if (s.phase === "won") w++;
  }
  return w / k;
};
function pava(ys) {
  const b = ys.map((y) => ({ y, w: 1 }));
  for (let i = 0; i < b.length - 1;) {
    if (b[i].y < b[i + 1].y) { const w = b[i].w + b[i + 1].w; b.splice(i, 2, { y: (b[i].y * b[i].w + b[i + 1].y * b[i + 1].w) / w, w }); if (i > 0) i--; }
    else i++;
  }
  return b.flatMap((x) => Array(x.w).fill(x.y));
}
const GRID = [0.25, 0.4, 0.55, 0.7, 0.85, 1.0, 1.2, 1.45, 1.75, 2.1];
for (let n = from; n <= to; n++) {
  const def = stageDef(n), want = target(n);
  const raw = GRID.map((e) => 0.5 * win(def, e, 1, runs) + 0.5 * win(def, e, 0.3, runs));
  const fit = pava(raw);
  let ease = GRID[GRID.length - 1];
  for (let i = 0; i < GRID.length; i++) {
    if (fit[i] <= want) {
      if (i === 0) { ease = GRID[0]; break; }
      const f = (fit[i - 1] - want) / Math.max(1e-6, fit[i - 1] - fit[i]);
      ease = GRID[i - 1] + f * (GRID[i] - GRID[i - 1]);
      break;
    }
  }
  ease = Math.round(ease * 100) / 100;
  console.log(n, ease.toFixed(2), `want=${want.toFixed(2)}`, `fit=${fit.map((v) => v.toFixed(2)).join(",")}`);
}
