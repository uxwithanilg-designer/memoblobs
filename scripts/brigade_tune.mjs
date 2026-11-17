// Blob Brigade auto-balance: for every campaign stage, finds the HP trim (Grumpies + villain) at which the par bot,
// with the upgrades a player has by that world, keeps about the target share of its biggest brigade.
//   node scripts/brigade_tune.mjs [worlds=0-9] [runs=10]          → fresh fit, prints "id tune keep win" lines
//   node scripts/brigade_tune.mjs [worlds=0-9] [runs=12] refine   → nudges STAGE_TUNE until the better bot wins 60-95% (LO/HI env)
// Paste the tunes into STAGE_TUNE in src/crowd/levels.ts.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const [w0, w1] = (process.argv[2] ?? "0-9").split("-").map(Number);
const runs = Number(process.argv[3] ?? 10);
const src = join(import.meta.dirname, "..", "src", "crowd");
const dir = mkdtempSync(join(tmpdir(), "brigade-tune-"));
for (const f of ["types", "levels", "sim", "leaders"]) writeFileSync(join(dir, `${f}.ts`), readFileSync(join(src, `${f}.ts`), "utf8").replace(/from "\.\/(\w+)"/g, 'from "./$1.ts"'));
const { STAGES, STAGE_TUNE, buildStage } = await import(pathToFileURL(join(dir, "levels.ts")).href);
const { Sim } = await import(pathToFileURL(join(dir, "sim.ts")).href);

// the share of the biggest brigade a good player should still have at the end (losses count as 0)
export function target(def) {
  if (def.world === 0) return [0.8, 0.7, 0.62, 1, 0.52, 0.52, 0.5, 0.5, 0.48, 0.45][def.s - 1];
  const base = 0.47 - 0.01 * def.world;
  return def.s === 1 ? base + 0.15 : def.s === 2 ? base + 0.05 : def.type === "boss" || def.type === "miniboss" ? base - 0.04 : base;
}
function play(def, tune, skill = 1) {
  const spec = buildStage(def, "plus", { tune });
  const L = Math.min(10, def.world);
  const s = new Sim(spec, { bot: true, skill, loadout: { leader: "momo", up: { start: L, fire: L, power: L, charge: L, coins: 0 } } });
  while (s.phase === "play" && s.t < 300) { s.step(1 / 30); s.events.length = 0; }
  const r = s.result();
  return { keep: r.won ? r.count / Math.max(1, r.peak) : 0, won: r.won };
}
const measure = (def, tune, skill = 1, k = runs) => {
  const rs = Array.from({ length: k }, () => play(def, tune, skill));
  return { keep: rs.reduce((a, r) => a + r.keep, 0) / k, win: rs.filter((r) => r.won).length / k };
};
// a good player is at least as good as the better of our two bots (par = sharp, kid = loose but steady)
const good = (def, tune, k) => { const a = measure(def, tune, 1, k), b = measure(def, tune, 0.3, k); return Math.max(a.keep, b.keep); };
// isotonic (non-increasing) fit, so noise cannot fool the crossing
function pava(ys) {
  const blocks = ys.map((y) => ({ y, w: 1 }));
  for (let i = 0; i < blocks.length - 1;) {
    if (blocks[i].y < blocks[i + 1].y) {
      const a = blocks[i], b = blocks[i + 1], w = a.w + b.w;
      blocks.splice(i, 2, { y: (a.y * a.w + b.y * b.w) / w, w });
      if (i > 0) i--;
    } else i++;
  }
  return blocks.flatMap((b) => Array(b.w).fill(b.y));
}
const GRID = Array.from({ length: 13 }, (_, i) => Math.exp(Math.log(0.3) + (i * (Math.log(5) - Math.log(0.3))) / 12));
// LO / HI: the band the better bot's win rate should land in (env, default 0.6 / 0.95)
const LO = Number(process.env.LO ?? 0.6), HI = Number(process.env.HI ?? 0.95);
if (process.argv[4] === "refine") {
  // walls and walkovers: the better of the two bots should win most runs but not every one with a big crowd left
  for (const def of STAGES) {
    if (def.world < w0 || def.world > w1) continue;
    if (def.type === "pinata") { console.log(def.id, "1.00", "-"); continue; }
    const want = target(def);
    let t = STAGE_TUNE[def.world * 10 + def.s - 1] ?? 1, step = 0.12, last = 0, m;
    for (let it = 0; it < 12; it++) {
      const a = measure(def, t, 1), b = measure(def, t, 0.3);
      m = { win: Math.max(a.win, b.win), keep: Math.max(a.keep, b.keep), par: a.win, kid: b.win };
      const dir = m.win < LO ? -1 : m.win >= HI && m.keep > want + 0.12 ? 1 : 0;
      if (!dir) break;
      if (last && dir !== last) step /= 2;
      last = dir;
      t = Math.min(6, Math.max(0.15, t * Math.exp(dir * step)));
    }
    console.log(def.id, t.toFixed(2), `win=${Math.round(m.win * 100)}%`, `keep=${m.keep.toFixed(2)}/${want.toFixed(2)}`, `par=${Math.round(m.par * 100)}%`, `kid=${Math.round(m.kid * 100)}%`);
  }
  process.exit(0);
}
for (const def of STAGES) {
  if (def.world < w0 || def.world > w1) continue;
  if (def.type === "pinata") { console.log(def.id, "1.00", "-", "-", "-"); continue; }
  const want = target(def);
  const fit = pava(GRID.map((t) => good(def, t, runs)));
  let tune = GRID[GRID.length - 1];
  for (let i = 0; i < GRID.length; i++) {
    if (fit[i] <= want) {
      if (i === 0) { tune = GRID[0]; break; }
      const f = (fit[i - 1] - want) / Math.max(1e-6, fit[i - 1] - fit[i]);
      tune = Math.exp(Math.log(GRID[i - 1]) + f * (Math.log(GRID[i]) - Math.log(GRID[i - 1])));
      break;
    }
  }
  tune = Math.round(tune * 100) / 100;
  const par = measure(def, tune, 1, runs * 2), kid = measure(def, tune, 0.3, runs * 2);
  console.log(def.id, tune.toFixed(2), `keep=${Math.max(par.keep, kid.keep).toFixed(2)}/${want.toFixed(2)}`, `par=${Math.round(par.win * 100)}%`, `kid=${Math.round(kid.win * 100)}%`, `fit=${fit.map((v) => v.toFixed(2)).join(",")}`);
}
