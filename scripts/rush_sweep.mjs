// Rollo Rush: build every journey stage (and runs of every mode) the way the game chains them, and report anything odd:
// build errors, slow builds, NaN frames, missing/odd finish lines, tilted joins, heights, bot failures, trimmed stages.
//   node scripts/rush_sweep.mjs [from=1] [to=520] [--modes] [--quiet]
// Node 22.6+ runs the TypeScript directly (type stripping).
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const nums = args.filter((a) => !a.startsWith("--")).map(Number);
const from = nums[0] ?? 1, to = nums[1] ?? 520;
const quiet = args.includes("--quiet");

const src = join(import.meta.dirname, "..", "src");
const dir = mkdtempSync(join(tmpdir(), "rush-"));
mkdirSync(join(dir, "data"));
const fix = (s) => s.replace(/from "\.\.\/roll\/rng"/g, 'from "./rng.ts"').replace(/from "(\.\/[\w/]+|\.\.\/[\w]+)"/g, (m, p) => `from "${p}.ts"`);
for (const f of readdirSync(join(src, "rush"))) if (f.endsWith(".ts")) writeFileSync(join(dir, f), fix(readFileSync(join(src, "rush", f), "utf8")));
for (const f of readdirSync(join(src, "rush", "data"))) if (f.endsWith(".ts")) writeFileSync(join(dir, "data", f), fix(readFileSync(join(src, "rush", "data", f), "utf8")));
writeFileSync(join(dir, "rng.ts"), readFileSync(join(src, "roll", "rng.ts"), "utf8"));
const imp = (f) => import(pathToFileURL(join(dir, `${f}.ts`)).href);
const { makeStage } = await imp("stages");
const { Track } = await imp("track");
const { botRun } = await imp("bot");
const { BUILD_STATS, knownAt } = await imp("gen");

const range = (a, b, step = 1) => { const out = []; for (let i = a; i <= b; i += step) out.push(i); return out; };
const goalOf = (st) => st.objs.find((o) => o.k === "goal")?.s ?? st.goal;
const issues = [], trimmedList = [];
let lowest = Infinity;
function chain(label, list, build) {
  let tr = null, st = null, y0;
  const F = new Float32Array(12);
  for (const n of list) {
    const before = { ...BUILD_STATS };
    const t0 = performance.now();
    let nx;
    try { nx = build(n, y0); } catch (e) { issues.push(`${label} ${n}: BUILD ERROR ${String(e.stack || e).split("\n").slice(0, 3).join(" | ")}`); tr = null; y0 = undefined; continue; }
    const ms = performance.now() - t0;
    const start = tr ? (() => { const fr = tr.frame(goalOf(st), F); return { p: [fr[0], fr[1], fr[2]], f: [fr[3], fr[4], fr[5]], u: [fr[6], fr[7], fr[8]] }; })() : null;
    const ntr = start ? new Track(nx.segs, undefined, start) : new Track(nx.segs, [0, nx.y0 ?? 24, 0]);
    const goals = nx.objs.filter((o) => o.k === "goal"), g = goalOf(nx), len = ntr.len;
    const a = ntr.frame(0, new Float32Array(12)), b = ntr.frame(Math.min(g, len), new Float32Array(12));
    const bad = [];
    if ([...a, ...b].some((v) => !Number.isFinite(v))) bad.push("NaN frame");
    if (goals.length !== 1) bad.push(`${goals.length} finish lines`);
    if (g > len - 5) bad.push(`finish ${Math.round(g)} too close to road end ${Math.round(len)}`);
    if (b[7] < 0.9) bad.push(`join tilted (up.y ${b[7].toFixed(2)})`);
    if (Math.abs(b[4]) > 0.2) bad.push(`join sloped (fwd.y ${b[4].toFixed(2)})`);
    if (b[1] < -40 || b[1] > 200) bad.push(`join height ${b[1].toFixed(1)}`);
    lowest = Math.min(lowest, ...range(0, Math.floor(len / 20)).map((i) => ntr.frame(i * 20, F)[1]));
    if (ms > 4000) bad.push(`slow build ${Math.round(ms)} ms`);
    // objects past the finish line or outside the road
    const late = nx.objs.filter((o) => o.k !== "goal" && o.k !== "cam" && o.s > g && o.s < len && !["pearl", "bigPearl", "lamp", "sign", "witch"].includes(o.k));
    if (late.length) bad.push(`${late.length} things after the finish (${[...new Set(late.map((o) => o.k))].slice(0, 4).join(",")})`);
    const outside = nx.objs.filter((o) => o.s < 0 || o.s > len + 1);
    if (outside.length) bad.push(`${outside.length} things off the road (${[...new Set(outside.map((o) => o.k))].slice(0, 4).join(",")})`);
    // things that can carry Rollo over the line in one go
    const jumpers = nx.objs.filter((o) => o.k === "tele" && o.s < g && o.s + (o.p ?? 30) > g - 2);
    if (jumpers.length) bad.push(`teleport over the finish`);
    if (nx.boss && len - g < 0) bad.push("boss stage without road after the finish");
    let bot = null;
    try { bot = botRun(nx, knownAt(nx.n)); } catch (e) { bad.push(`bot crashed: ${String(e).slice(0, 80)}`); }
    if (bot && !bot.ok) bad.push(`bot fails: ${bot.why} @${Math.round(bot.at)}`);
    const trimmed = BUILD_STATS.trimmed > before.trimmed;
    if (trimmed) trimmedList.push(`${label} ${n}`);
    const line = `${label} ${String(n).padStart(3)} w${nx.world ?? nx.look?.world} ${nx.kind ?? ""}${nx.boss ? " BOSS:" + nx.boss.kind : ""} goal=${Math.round(g)} road=${Math.round(len)} y=${b[1].toFixed(0)} ${Math.round(ms)}ms`;
    if (bad.length) issues.push(`${line} -> ${bad.join("; ")}`);
    if (!quiet) console.log(line + (bad.length ? `  !! ${bad.join("; ")}` : ""));
    tr = ntr; st = nx; y0 = Math.round(b[1] * 10) / 10;
  }
}

chain("journey", range(from, to), (n, y0) => makeStage(n, 777, undefined, y0));
if (args.includes("--modes")) {
  chain("endless", range(1, 40), (k, y0) => makeStage(k, 777, undefined, y0, { id: "endless", seed: 99, upto: 120, bosses: 1 }));
  chain("boss", range(1, 25), (k, y0) => makeStage(k, 777, undefined, y0, { id: "boss", seed: 5, upto: 500, bosses: 25 }));
  chain("park", range(1, 15), (k, y0) => makeStage(k, 777, undefined, y0, { id: "park", seed: 7, upto: 200, bosses: 1 }));
  for (const day of [1, 17, 300, 1201]) chain("daily", [1], (k, y0) => makeStage(k, 777, undefined, y0, { id: "daily", seed: day, upto: 50, bosses: 1 }));
  for (const n of [1, 37, 120, 260, 480]) chain("trial", [1], (k, y0) => makeStage(k, 777, undefined, y0, { id: "trial", seed: 3, upto: 500, n, bosses: 1 }));
}
console.log(`\n${issues.length} stage(s) with notes; build stats ${JSON.stringify(BUILD_STATS)}; trimmed ${trimmedList.length}; lowest road ${lowest.toFixed(0)} m`);
for (const i of issues) console.log(" - " + i);
