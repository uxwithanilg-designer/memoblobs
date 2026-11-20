// Rollo Rush: build a long mode run (default Endless Moon Run) the way the game chains it — each stage's track joined
// onto the previous goal — and report where things go wrong: build errors, NaN frames, heights, goals, distance.
//   node scripts/rush_chain.mjs [stages=60] [--mode=endless] [--upto=30] [--seed=12345] [--bot]
// Node 22.6+ runs the TypeScript directly (type stripping).
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const count = Number(args.find((a) => !a.startsWith("--")) ?? 60);
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) ?? `=${d}`).split("=")[1];
const modeId = opt("mode", "endless"), upto = Number(opt("upto", 30)), seed = Number(opt("seed", 12345));
const useBot = args.includes("--bot");

const src = join(import.meta.dirname, "..", "src");
const dir = mkdtempSync(join(tmpdir(), "rush-"));
mkdirSync(join(dir, "data"));
const fix = (s) => s.replace(/from "\.\.\/roll\/rng"/g, 'from "./rng.ts"').replace(/from "(\.\/[\w/]+|\.\.\/[\w]+)"/g, (m, p) => `from "${p}.ts"`);
for (const f of readdirSync(join(src, "rush"))) if (f.endsWith(".ts")) writeFileSync(join(dir, f), fix(readFileSync(join(src, "rush", f), "utf8")));
for (const f of readdirSync(join(src, "rush", "data"))) if (f.endsWith(".ts")) writeFileSync(join(dir, "data", f), fix(readFileSync(join(src, "rush", "data", f), "utf8")).replace(/from "\.\.\/(\w+)\.ts"/g, 'from "../$1.ts"'));
writeFileSync(join(dir, "rng.ts"), readFileSync(join(src, "roll", "rng.ts"), "utf8"));
const imp = (f) => import(pathToFileURL(join(dir, `${f}.ts`)).href);
const { makeStage } = await imp("stages");
const { Track } = await imp("track");
const { botRun } = await imp("bot");

const mode = { id: modeId, seed, upto, bosses: 1 };
const goalOf = (st) => st.objs.find((o) => o.k === "goal")?.s ?? st.goal;
let tr = null, st = null, odo = 0, y0;
const F = new Float32Array(12);
for (let k = 1; k <= count; k++) {
  let nx;
  try { nx = makeStage(k, 777, undefined, y0, mode); }
  catch (e) { console.log(`k=${k} BUILD ERROR`, String(e.stack || e).split("\n").slice(0, 4).join(" | ")); break; }
  let start;
  if (tr) { const fr = tr.frame(goalOf(st), F); start = { p: [fr[0], fr[1], fr[2]], f: [fr[3], fr[4], fr[5]], u: [fr[6], fr[7], fr[8]] }; }
  const ntr = start ? new Track(nx.segs, undefined, start) : new Track(nx.segs, [0, nx.y0 ?? 24, 0]);
  const g = goalOf(nx), len = nx.segs.reduce((a, s) => a + s.len, 0);
  const a = ntr.frame(0, new Float32Array(12)), b = ntr.frame(g, new Float32Array(12));
  const bad = [...a, ...b].some((v) => !Number.isFinite(v));
  let botTxt = "";
  if (useBot) { const r = botRun(nx, nx.known ?? [], ntr); botTxt = ` bot:${r.ok ? "ok" : "FAIL " + r.why + "@" + Math.round(r.at)}`; }
  const kinds = [...new Set(nx.segs.map((s) => s.tag).filter(Boolean))].join(",");
  const fu = `f=(${b[3].toFixed(2)},${b[4].toFixed(2)},${b[5].toFixed(2)}) u=(${b[6].toFixed(2)},${b[7].toFixed(2)},${b[8].toFixed(2)})`;
  const tail = nx.segs.slice(-3).map((x) => `${x.tag ?? "?"}:${Math.round(x.len)}`).join(" ");
  console.log(`k=${String(k).padStart(3)} ${fu} tail[${tail}]`);
  console.log(`k=${String(k).padStart(3)} ${nx.name?.slice(0, 26).padEnd(26)} goal=${String(Math.round(g)).padStart(5)} track=${String(Math.round(len)).padStart(5)} odo=${((odo + g) / 1000).toFixed(2)}km  start y=${a[1].toFixed(1)} end=(${b[0].toFixed(0)},${b[1].toFixed(1)},${b[2].toFixed(0)})${bad ? " NaN!" : ""} goalObj=${nx.objs.some((o) => o.k === "goal")} ${g > len ? "GOAL>TRACK!" : ""}${botTxt} [${kinds}]`);
  odo += g; tr = ntr; st = nx; y0 = Math.round(b[1] * 10) / 10;
}
