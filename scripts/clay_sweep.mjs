// Puddo's Clayland: Rain Raid stage sweep: builds stages and lets the autopilot play them headless. Prints, per stage,
// whether the bot cleared it, how far it got, lives left, enemies melted, coins, time and the build stats — a quick check
// that the 400 stages (and the Endless Storm) build, are finishable and ramp up. Node 22.6+ runs the TypeScript
// directly (type stripping).
//   node scripts/clay_sweep.mjs [from=1] [to=80] [skill=1] [lives=3] [up]
// "up" gives the bot the Blaster Shop upgrades a player has usually bought by that zone (none in zones 1-4).
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const from = Number(process.argv[2] ?? 1), to = Number(process.argv[3] ?? 80), skill = Number(process.argv[4] ?? 1), lives = Number(process.argv[5] ?? 3);
const withUp = process.argv[6] === "up";
/** the shop levels a player typically owns by a zone (coins earned so far, spent on power first) */
const upFor = (zone) => zone <= 4 ? { rate: 0, dmg: 0, bombs: 0, hearts: 0, magnet: 0 } : zone <= 8 ? { rate: 2, dmg: 2, bombs: 1, hearts: 1, magnet: 1 } : zone <= 12 ? { rate: 3, dmg: 3, bombs: 2, hearts: 2, magnet: 1 } : { rate: 4, dmg: 4, bombs: 3, hearts: 3, magnet: 2 };
const src = join(import.meta.dirname, "..", "src", "clayland");
const dir = mkdtempSync(join(tmpdir(), "clay-"));
for (const f of ["types", "islands", "physics", "bestiary", "stages", "sim", "bossai", "weapons", "bot"]) {
  const code = readFileSync(join(src, `${f}.ts`), "utf8").replace(/from "\.\/(\w+)"/g, 'from "./$1.ts"');
  writeFileSync(join(dir, `${f}.ts`), code);
}
const { buildStage, stageSummary } = await import(pathToFileURL(join(dir, "stages.ts")).href);
const { Sim } = await import(pathToFileURL(join(dir, "sim.ts")).href);
const { botInput, newBotMem } = await import(pathToFileURL(join(dir, "bot.ts")).href);
const { upgradeEffects } = await import(pathToFileURL(join(dir, "weapons.ts")).href);

let cleared = 0, total = 0;
const byConcept = {};
for (let n = from; n <= to; n++) {
  const t0 = performance.now();
  const st = buildStage(n);
  const tb = performance.now() - t0;
  const fx = upgradeEffects(upFor(withUp ? Math.ceil(Math.min(n, 400) / 20) : 1));
  const s = new Sim(st, { hearts: fx.hearts, lives, fireMul: fx.fireMul, dmgMul: fx.dmgMul, maxBombs: fx.maxBombs, magnet: fx.magnet });
  const m = newBotMem();
  let steps = 0, best = 0;
  const max = 120 * 420;
  while (!s.done && steps < max) { s.step(botInput(s, m, skill)); s.events.length = 0; steps++; best = Math.max(best, st.h > 40 ? (st.goal.y > st.start.y ? s.y / st.goal.y : (st.start.y - s.y) / (st.start.y - st.goal.y)) : s.x / st.goal.x); }
  const r = s.result();
  total++; if (r.cleared) cleared++;
  const c = (byConcept[st.concept] ??= { n: 0, clear: 0 }); c.n++; if (r.cleared) c.clear++;
  const sum = stageSummary(st);
  const why = r.cleared ? "CLEAR" : steps >= max ? "time " : "lost ";
  console.log(`${String(n).padStart(3)} ${sum.concept.padEnd(10)} ${sum.zone.padEnd(19).slice(0, 19)} d=${sum.d.toFixed(2)} w=${String(sum.w).padStart(4)} h=${String(sum.h).padStart(3)} foes=${String(sum.enemies).padStart(3)} | ${why} ${String(Math.round(best * 100)).padStart(3)}% lives=${r.livesLeft} hits=${String(r.hits).padStart(2)} melted=${String(r.melted).padStart(3)} combo=${String(r.bestCombo).padStart(2)} coins=${String(r.coins).padStart(4)} t=${String(Math.round(r.time)).padStart(3)}s ${tb.toFixed(1)}ms  ${r.name}`);
}
console.log(`\ncleared ${cleared}/${total} (${Math.round((cleared / total) * 100)}%)`);
console.log(Object.entries(byConcept).map(([k, v]) => `${k} ${v.clear}/${v.n}`).join(" · "));
