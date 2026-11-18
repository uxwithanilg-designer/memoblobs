// Momo Dash! balance sweep: the bot does whole runs (Subway style: start at the beginning, run until caught) and we
// print how far it got, which world, and what stopped it.
//   node scripts/dash_sweep.mjs [runs=4] [skill=1] [start=1] [maxKm=20]
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const runs = Number(process.argv[2] ?? 4), skill = Number(process.argv[3] ?? 1), start = Number(process.argv[4] ?? 1), maxKm = Number(process.argv[5] ?? 20);
const src = join(import.meta.dirname, "..", "src", "dash");
const dir = mkdtempSync(join(tmpdir(), "dash-"));
for (const f of ["types", "chunks", "levels", "sim"]) writeFileSync(join(dir, `${f}.ts`), readFileSync(join(src, `${f}.ts`), "utf8").replace(/from "\.\/(\w+)"/g, 'from "./$1.ts"'));
const { WORLDS, sectionOf, STAGE_M } = await import(pathToFileURL(join(dir, "levels.ts")).href);
const { Sim } = await import(pathToFileURL(join(dir, "sim.ts")).href);

console.log(`runs=${runs} skill=${skill} start=${start}`);
const t0 = Date.now(), dists = [];
for (let k = 0; k < runs; k++) {
  const s = new Sim({ seed: 1000 + k * 7919 + start, start }, { bot: true, skill });
  s.botSeed(k);
  let why = "", saves = 0, boosts = 0, worldsSeen = new Set(), vmax = 0;
  while (s.phase === "play" && s.z < maxKm * 1000) {
    s.step(1 / 60);
    vmax = Math.max(vmax, s.base);
    for (const e of s.events) { if (e.t === "crash") why = e.by; if (e.t === "friendSave" || e.t === "shieldPop") saves++; if (e.t === "boost" && e.on) boosts++; }
    s.events.length = 0;
    worldsSeen.add(s.sec.world);
  }
  const n = s.track.stageAt(s.z), sec = sectionOf(n);
  dists.push(s.z);
  console.log(`run ${k}: ${Math.round(s.z)} m  stage ${n} (${sec.place}, s${sec.s})  ${Math.round(s.t)}s  vmax ${vmax.toFixed(1)}  coins ${s.stats.coins}  tricks ${s.stats.tricks}  saves ${saves}  boosts ${boosts}  caught ${s.caught}  ${s.phase === "play" ? "made it" : "lost: " + why}`);
}
dists.sort((a, b) => a - b);
console.log(`median ${Math.round(dists[Math.floor(dists.length / 2)])} m  (${((Date.now() - t0) / 1000).toFixed(0)}s)  world length ${STAGE_M * 20} m`);
