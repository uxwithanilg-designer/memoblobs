// Small copies of the big game pictures, for cards and thumbnails: every public/games/<slug>/{cover,hero,thumb,poster}.webp
// gets a 640-px-wide <name>-sm.webp beside it. The static build's image loader (src/lib/image-loader.ts) picks the small
// copy wherever a picture is shown 640 px wide or less (game cards and rows, search, the game page's poster), so a page
// full of cards loads ~20 KB a card instead of ~100 KB. Runs in `npm run build:static` before the asset list is made;
// commit the files it writes (they go to R2 with the rest of the game's pictures). A copy is made again when its big
// picture is newer. `node scripts/gen-small-art.mjs` runs it on its own.
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** the pictures that get a small copy (keep in step with SMALL in src/lib/image-loader.ts) */
const BIG = /^(cover|hero|thumb|poster)\.webp$/;
const WIDTH = 640;
const ROOT = "public/games";

const jobs = [];
for (const slug of existsSync(ROOT) ? readdirSync(ROOT) : []) {
  const dir = join(ROOT, slug);
  if (!statSync(dir).isDirectory()) continue;
  for (const name of readdirSync(dir).filter((n) => BIG.test(n))) {
    const src = join(dir, name), dest = join(dir, name.replace(/\.webp$/, "-sm.webp"));
    // 2 s of slack: a fresh git checkout writes the two files a moment apart
    if (!existsSync(dest) || statSync(src).mtimeMs > statSync(dest).mtimeMs + 2000) jobs.push([src, dest]);
  }
}

if (jobs.length) {
  let sharp;
  try { sharp = (await import("sharp")).default; } catch {
    console.error(`small art: ${jobs.length} small copies are missing and sharp isn't installed — run \`npm ci\`, then this again:\n  - ${jobs.map(([, d]) => d).join("\n  - ")}`);
    process.exit(1);
  }
  for (const [src, dest] of jobs) {
    const out = await sharp(src).resize({ width: WIDTH, withoutEnlargement: true }).webp({ quality: 78, effort: 6, smartSubsample: true, alphaQuality: 90 }).toBuffer();
    writeFileSync(dest, out);
  }
  console.log(`small art: made ${jobs.length} small copies (${WIDTH} px wide) for cards and posters — commit them`);
}
