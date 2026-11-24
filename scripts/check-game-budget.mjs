// The hosting rule (AGENTS.md → "Hosting budget"): every game uses exactly one file on the site (the Cloudflare
// Worker) — its own page, games/<slug>.html — and every game file (sound, music, art, font, its game.json) is served
// from the R2 bucket, never from the site. With ~1,000 files for the site itself, that leaves room for about 19,000
// games under the free plan's 20,000 files. Runs at the end of `npm run build:static`: a game outside the budget
// fails the build, so it can't be deployed.  usage: node scripts/check-game-budget.mjs
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { ASSET_DIRS } from "./r2/config.mjs";

const OUT = "out";
const MIN = 1, MAX = 1;
/** Cloudflare Workers free plan: files per deploy */
const WORKER_FILE_LIMIT = 20000;
const MEDIA = /\.(mp3|ogg|wav|webp|png|jpe?g|gif|svg|avif|json|woff2?|ttf|otf|mp4|webm|glb|gltf|bin)$/i;

if (!existsSync(OUT)) { console.error("check-game-budget: no out/ folder — run `npm run build:static`"); process.exit(1); }
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(OUT).map((p) => relative(OUT, p).split(sep).join("/"));
const problems = [];

// 1) game files belong in R2: none may ship with the site
const media = files.filter((f) => ASSET_DIRS.includes(f.split("/")[0]) && MEDIA.test(f) && !f.split("/").pop().startsWith("__next."));
if (media.length) problems.push(`${media.length} game files are in the site deploy (they must come from R2 via cdn()/next/image): ${media.slice(0, 5).join(", ")}${media.length > 5 ? ", …" : ""}`);

// 2) every game: one site file, its page. A file belongs to a game when a path segment is the game's slug
//    ("games/momo-dash.html", "games/momo-dash/__next._tree.txt", "play/momo-dash.html", …)
const slugs = readdirSync(join(OUT, "games")).filter((f) => f.endsWith(".html")).map((f) => f.slice(0, -5));
const per = new Map(slugs.map((s) => [s, []]));
for (const f of files) {
  for (const seg of f.split("/")) {
    const s = per.has(seg) ? seg : seg.includes(".") && per.has(seg.slice(0, seg.indexOf("."))) ? seg.slice(0, seg.indexOf(".")) : null;
    if (s) { per.get(s).push(f); break; }
  }
}
const counts = [...per.values()].map((l) => l.length);
for (const [s, l] of per) {
  if (l.length > MAX) problems.push(`${s}: ${l.length} site files (only its page is allowed; no per-game routes or files — put them on R2) — ${l.join(", ")}`);
  else if (l.length < MIN) problems.push(`${s}: no page on the site — is it missing from src/lib/games.ts?`);
}

// 3) the whole site must stay inside the Worker's file limit
if (files.length > WORKER_FILE_LIMIT) problems.push(`the site has ${files.length} files; Cloudflare's free plan allows ${WORKER_FILE_LIMIT}`);

// 4) the code every page loads must not grow with the games: each game's code is its own file, loaded only when that
//    game opens, and the games list is data (/data/catalog.json), not code. Checked on the home page, a game's page and
//    the player: none may carry the games list (game taglines) or a 3D engine (three.js) in its first-load code.
const shared = [];
const catalogFile = join(OUT, "data", "catalog.json");
const taglines = existsSync(catalogFile) ? JSON.parse(readFileSync(catalogFile, "utf8")).games.map((g) => g.tagline).filter((t) => t && t.length > 25) : [];
for (const [label, page] of [["home", "index.html"], ["game page", `games/${slugs[0]}.html`], ["player", "play.html"]]) {
  if (!existsSync(join(OUT, page))) continue;
  const chunks = [...new Set([...readFileSync(join(OUT, page), "utf8").matchAll(/\/_next\/static\/[^"'\s\\]+?\.js/g)].map((m) => m[0]))]
    .map((u) => join(OUT, ...u.split("/").filter(Boolean))).filter((p) => existsSync(p));
  const code = chunks.map((p) => readFileSync(p, "utf8")).join("\n");
  const listed = taglines.filter((t) => code.includes(t)).length;
  if (listed >= 3) problems.push(`the ${label}'s code carries the games list (${listed} game taglines in it): browser code must load it from /data/catalog.json (src/lib/catalog-data.ts), not import src/lib/games.ts or src/lib/lists.ts`);
  if (/WebGLRenderer/.test(code)) problems.push(`the ${label}'s code carries three.js: a 3D engine must load only when its game opens (dynamic import in GameView.tsx)`);
  shared.push(`${label} ${Math.round(chunks.reduce((n, p) => n + statSync(p).size, 0) / 1024)} KB`);
}
if (shared.length) console.log(`site code: ${shared.join(", ")} loaded first (no games list, no 3D engine: the same with 60 games or 6,000)`);

const room = Math.floor((WORKER_FILE_LIMIT - files.length) / MAX);
console.log(`game budget: ${slugs.length} games, ${Math.min(...counts)}–${Math.max(...counts)} site file each (rule: ${MAX}); `
  + `site ${files.length}/${WORKER_FILE_LIMIT} files (room for ~${room} more games)`);
if (files.length > WORKER_FILE_LIMIT * 0.8) console.warn(`game budget: warning — the site uses over 80% of the Worker file limit`);
if (problems.length) {
  console.error("\ngame budget FAILED (see AGENTS.md → Hosting budget):\n  - " + problems.join("\n  - "));
  process.exit(1);
}
