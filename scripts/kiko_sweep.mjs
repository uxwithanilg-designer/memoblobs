// Kiko's Jungle Quest balance sweep: the bot does whole runs (start at Kiko's Treehouse, run until the hearts are gone)
// and we print how far it got, which region, how many hearts it lost and to what.
//   node scripts/kiko_sweep.mjs [runs=4] [skill=1] [start=1] [maxKm=20]
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const runs = Number(process.argv[2] ?? 4), skill = Number(process.argv[3] ?? 1), start = Number(process.argv[4] ?? 1), maxKm = Number(process.argv[5] ?? 20);
const src = join(import.meta.dirname, "..", "src", "jungle");
const dir = mkdtempSync(join(tmpdir(), "kiko-"));
for (const f of ["types", "chunks", "regions", "levels", "sim"]) writeFileSync(join(dir, `${f}.ts`), readFileSync(join(src, `${f}.ts`), "utf8").replace(/from "\.\/(\w+)"/g, 'from "./$1.ts"'));
const { sectionOf, STAGE_M } = await import(pathToFileURL(join(dir, "levels.ts")).href);
const { Sim } = await import(pathToFileURL(join(dir, "sim.ts")).href);

console.log(`runs=${runs} skill=${skill} start=${start}`);
const t0 = Date.now(), dists = [];
for (let k = 0; k < runs; k++) {
  const s = new Sim({ seed: 1000 + k * 7919 + start, start }, { bot: true, skill });
  s.botSeed(k);
  const why = {}; let boosts = 0, rushes = 0, vmax = 0, hearts = 0, vines = 0;
  while (s.phase === "play" && s.z < maxKm * 1000) {
    s.step(1 / 60);
    vmax = Math.max(vmax, s.base);
    for (const e of s.events) {
      if (e.t === "hurt") { const n = sectionOf(s.track.stageAt(s.z)); const key = `${e.by}@${n.piece}`; why[key] = (why[key] ?? 0) + 1; }
      if (e.t === "boost" && e.on) { if (e.rush) rushes++; else boosts++; }
      if (e.t === "heart") hearts++;
      if (e.t === "grab") vines++;
    }
    s.events.length = 0;
  }
  const n = s.track.stageAt(s.z), sec = sectionOf(n);
  dists.push(s.z);
  console.log(`run ${k}: ${Math.round(s.z)} m  place ${n} (${sec.place}, s${sec.s})  ${Math.round(s.t)}s  vmax ${vmax.toFixed(1)}  🍌${s.stats.bananas} fruit ${s.stats.fruits} gold ${s.stats.golden}  vines ${vines}  +hearts ${hearts}  rush ${rushes} boost ${boosts}  seeds ${s.seeds}  ${s.phase === "play" ? "made it" : "out"}  hurts ${JSON.stringify(why)}`);
}
dists.sort((a, b) => a - b);
console.log(`median ${Math.round(dists[Math.floor(dists.length / 2)])} m  (${((Date.now() - t0) / 1000).toFixed(0)}s)  region length ${STAGE_M * 20} m`);
