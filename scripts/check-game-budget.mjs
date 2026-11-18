// The hosting rule (AGENTS.md → "Hosting budget"): every game uses 6–9 files on the site (the Cloudflare Worker) —
// its own page /games/<slug> and Next's data files for it — and every game file (sound, music, art, font) is served
// from the R2 bucket, never from the site. Runs at the end of `npm run build:static`: a game outside the budget fails
// the build, so it can't be deployed.  usage: node scripts/check-game-budget.mjs
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { ASSET_DIRS } from "./r2/config.mjs";

const OUT = "out";
const MIN = 6, MAX = 9;
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

// 2) every live game: 6–9 site files (its page + Next's data). A file belongs to a game when a path segment is the
//    game's slug ("games/momo-dash.html", "games/momo-dash/__next._tree.txt", "play/momo-dash.html", …)
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
  if (l.length > MAX) problems.push(`${s}: ${l.length} site files (max ${MAX}) — ${l.join(", ")}`);
  else if (l.length < MIN) problems.push(`${s}: only ${l.length} site files (min ${MIN}) — is its page missing? ${l.join(", ")}`);
}

// 3) the whole site must stay inside the Worker's file limit
if (files.length > WORKER_FILE_LIMIT) problems.push(`the site has ${files.length} files; Cloudflare's free plan allows ${WORKER_FILE_LIMIT}`);

const room = Math.floor((WORKER_FILE_LIMIT - files.length) / MAX);
console.log(`game budget: ${slugs.length} games, ${Math.min(...counts)}–${Math.max(...counts)} site files each (rule ${MIN}–${MAX}); `
  + `site ${files.length}/${WORKER_FILE_LIMIT} files (room for ~${room} more games)`);
if (files.length > WORKER_FILE_LIMIT * 0.8) console.warn(`game budget: warning — the site uses over 80% of the Worker file limit`);
if (problems.length) {
  console.error("\ngame budget FAILED (see AGENTS.md → Hosting budget):\n  - " + problems.join("\n  - "));
  process.exit(1);
}
