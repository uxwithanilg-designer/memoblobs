// The mobile performance rule (AGENTS.md → "Mobile performance"): every game runs on the shared kit in
// src/lib/perf.ts, so phones — Android above all — stay smooth and cool, and a new game can't quietly bring back what
// made them hang. Runs at the end of `npm run build:static` (and `npm run check:perf`); a game that breaks a rule fails
// the build. A file may opt out of a rule only with a `// perf-ok: <why>` comment (an offscreen thumbnail renderer…).
//   1. every three.js renderer sets its resolution with pixelRatioFor() (phones top out at 1.5, not 2–3.5)
//   2. nothing sets a pixel ratio straight from window.devicePixelRatio
//   3. only src/lib/audio.ts makes an AudioContext (one sound engine: one voice budget, one reverb, one buffer size)
//   4. the game player installs the frame cap and the lite UI (no CSS blur over the game on phones)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk("src").filter((f) => /\.(ts|tsx)$/.test(f)).map((p) => ({ p: relative(".", p).split(sep).join("/"), s: readFileSync(p, "utf8") }));
const problems = [];
const ok = (f) => f.s.includes("perf-ok:");

for (const f of files) {
  if (f.p === "src/lib/perf.ts") continue;
  if (f.s.includes("new THREE.WebGLRenderer(") && !f.s.includes("pixelRatioFor(") && !ok(f))
    problems.push(`${f.p}: makes a WebGLRenderer without pixelRatioFor() from @/lib/perf`);
  if (/setPixelRatio\([^)]*window\.devicePixelRatio/.test(f.s) && !ok(f))
    problems.push(`${f.p}: sets a pixel ratio from window.devicePixelRatio (use pixelRatioFor(quality))`);
  if (/new (window\.)?(AudioContext|webkitAudioContext)\b|new AC\(/.test(f.s) && f.p !== "src/lib/audio.ts" && !ok(f))
    problems.push(`${f.p}: makes its own AudioContext (play sound through @/lib/audio)`);
}
const player = files.find((f) => f.p === "src/components/player/GamePlayer.tsx");
if (!player || !player.s.includes("installFrameCap(") || !player.s.includes("setLiteUi(")) problems.push("src/components/player/GamePlayer.tsx: must install the frame cap and the lite UI");
const css = readFileSync("src/app/globals.css", "utf8");
if (!css.includes("html.perf-lite")) problems.push("src/app/globals.css: the html.perf-lite rule (no backdrop blur while a game runs on a phone) is missing");

if (problems.length) {
  console.error(`mobile performance check FAILED (${problems.length}):\n  ` + problems.join("\n  "));
  process.exit(1);
}
console.log(`mobile performance: ${files.filter((f) => f.s.includes("new THREE.WebGLRenderer(")).length} renderers on the shared kit, one sound engine, frame cap and lite UI in the player`);
