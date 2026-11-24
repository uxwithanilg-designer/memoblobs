// Builds the whole site as static files in out/ (for Cloudflare): `npm run build:static`.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { ASSET_BASE, ASSET_DIRS } from "./r2/config.mjs";
import { listAssets, writeIndex } from "./r2/asset-index.mjs";
import { readRemoteList } from "./r2/remote-list.mjs";

// game files load from R2 (scripts/r2/config.mjs); their URLs carry the asset version so browsers can cache them
// the light games list for browser code and each game's about.json (from src/lib/games.ts), before anything is built
const gen = spawnSync("node scripts/gen-game-index.mjs", { stdio: "inherit", shell: true });
if (gen.status !== 0) process.exit(gen.status ?? 1);
// (the bucket's upload list gives the sizes of game files that aren't on disk, as in GitHub Actions)
const { version, versions, bundles, files: assets } = writeIndex(listAssets((await readRemoteList()) ?? {}));
// every live game needs its pictures (on disk, or in git for GitHub Actions): the card cover (hero), the game page's
// poster and the link-preview image. A missing one would show as a broken picture on the live site.
{
  const have = new Set(assets.map((f) => f.key));
  const { games: live } = JSON.parse(readFileSync("public/data/catalog.json", "utf8"));
  const missing = live.flatMap((g) => [g.hero.replace(/^\//, ""), `games/${g.slug}/poster.webp`, `games/${g.slug}/og.jpg`].filter((k) => !have.has(k)));
  if (missing.length) {
    console.error(`build-static: live games are missing pictures (put them in public/ and commit them):\n  - ${missing.join("\n  - ")}`);
    process.exit(1);
  }
}
console.log(`build-static: game files from ${ASSET_BASE} (asset version ${version}, ${bundles} bundles)`);
// the version table goes into the site's code (src/lib/cdn.ts): a file's URL changes only with its own bucket
const env = { ...process.env, STATIC_EXPORT: "1", NEXT_PUBLIC_ASSET_BASE: ASSET_BASE, NEXT_PUBLIC_ASSET_VER: version, NEXT_PUBLIC_ASSET_VERS: versions };
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

// One site file per game (AGENTS.md → "Hosting budget"): a game's page is just games/<slug>.html. Next also writes 6
// data files per page for in-app navigation (games/<slug>.txt and games/<slug>/__next.*.txt); game pages are opened
// with normal links instead (gameHref in src/lib/catalog.ts), so those files are left out. The /games list page's own
// files (games.html, games.txt, games/__next.*.txt) stay.
let pageData = 0;
const gamesDir = join("out", "games");
if (existsSync(gamesDir)) {
  for (const f of readdirSync(gamesDir).filter((n) => n.endsWith(".html"))) {
    const slug = f.slice(0, -5);
    for (const p of [join(gamesDir, `${slug}.txt`), join(gamesDir, slug)]) {
      if (!existsSync(p)) continue;
      if (statSync(p).isDirectory()) { pageData += files(p).length; rmSync(p, { recursive: true, force: true }); }
      else { rmSync(p); pageData++; }
    }
  }
}
if (pageData) console.log(`build-static: ${pageData} navigation data files of game pages left out (game pages are one file each)`);

// the hosting rule every game must follow (AGENTS.md): one site file per game, game files only in R2
const check = spawnSync("node scripts/check-game-budget.mjs", { stdio: "inherit", shell: true });
if (check.status !== 0) process.exit(check.status ?? 1);
// the mobile performance rule (AGENTS.md): every game on the shared kit in src/lib/perf.ts
const perf = spawnSync("node scripts/check-perf.mjs", { stdio: "inherit", shell: true });
if (perf.status !== 0) process.exit(perf.status ?? 1);
