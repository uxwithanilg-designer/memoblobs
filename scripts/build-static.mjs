// Builds the whole site as static files in out/ (for Cloudflare): `npm run build:static`.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { ASSET_BASE, ASSET_DIRS } from "./r2/config.mjs";
import { writeIndex } from "./r2/asset-index.mjs";

// game files load from R2 (scripts/r2/config.mjs); their URLs carry the asset version so browsers can cache them
const { version } = writeIndex();
console.log(`build-static: game files from ${ASSET_BASE} (asset version ${version})`);
const env = { ...process.env, STATIC_EXPORT: "1", NEXT_PUBLIC_ASSET_BASE: ASSET_BASE, NEXT_PUBLIC_ASSET_VER: version };
const r = spawnSync("npx next build", { stdio: "inherit", shell: true, env });
if (r.status !== 0) process.exit(r.status ?? 1);

// On Windows, `next export` writes the router's segment files into folders (__next.X/a/b/__PAGE__.txt) instead of
// one dotted file (__next.X.a.b.__PAGE__.txt), so the client's prefetches 404. Flatten them (nothing to do on Linux).
let moved = 0;
const files = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : [p]; });
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (!statSync(p).isDirectory()) continue;
    if (name.startsWith("__next.")) {
      for (const f of files(p)) {
        const rel = f.slice(p.length + 1).split(/[\\/]/).join(".");
        const dest = join(dir, `${name}.${rel}`);
        if (!existsSync(dest)) { mkdirSync(dir, { recursive: true }); renameSync(f, dest); moved++; }
      }
      rmSync(p, { recursive: true, force: true });
    } else walk(p);
  }
}
if (existsSync("out")) walk("out");
if (moved) console.log(`build-static: flattened ${moved} router segment files`);

// Game files (sounds, music, art, fonts) live only in the R2 bucket (`npm run upload:r2`): take the site's copies out
// of the deploy. Pages and Next's own data files in those folders (games/<slug>.html, __next.*.txt) stay.
const MEDIA = /\.(mp3|ogg|wav|webp|png|jpe?g|gif|svg|avif|json|woff2?|ttf|otf|mp4|webm|glb|gltf|bin)$/i;
let stripped = 0;
function strip(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { strip(p); if (!readdirSync(p).length) rmSync(p, { recursive: true }); }
    else if (MEDIA.test(name) && !name.startsWith("__next.")) { rmSync(p); stripped++; }
  }
}
for (const d of ASSET_DIRS) { const p = join("out", d); strip(p); if (existsSync(p) && !readdirSync(p).length) rmSync(p, { recursive: true }); }
console.log(`build-static: ${stripped} game files left out of the site (they're served from R2)`);

// the hosting rule every game must follow (AGENTS.md): 6–9 site files per game, game files only in R2
const check = spawnSync("node scripts/check-game-budget.mjs", { stdio: "inherit", shell: true });
if (check.status !== 0) process.exit(check.status ?? 1);
// the mobile performance rule (AGENTS.md): every game on the shared kit in src/lib/perf.ts
const perf = spawnSync("node scripts/check-perf.mjs", { stdio: "inherit", shell: true });
if (perf.status !== 0) process.exit(perf.status ?? 1);
