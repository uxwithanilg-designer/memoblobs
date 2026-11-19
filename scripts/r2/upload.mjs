// Uploads the game files (public/audio, games, brand, fonts) to the R2 bucket. Only new or changed files go up
// (it remembers what it sent in .r2-uploaded.json); `--all` sends everything again.
// usage: npm run upload:r2 [-- --all]
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { CONTENT_TYPES, R2_BUCKET } from "./config.mjs";
import { writeIndex } from "./asset-index.mjs";

const STATE = ".r2-uploaded.json";
/** URLs carry ?v=<asset version>, so browsers may keep each file for a year */
const CACHE = "public, max-age=31536000, immutable";

const { version, files } = writeIndex();
const index = { key: "audio/index.json", path: join("public", "audio", "index.json"), md5: `index-${version}` };
const all = [...files, index];
const sent = !process.argv.includes("--all") && existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
const todo = all.filter((f) => sent[f.key] !== f.md5);
console.log(`R2 ${R2_BUCKET}: ${all.length} files, ${todo.length} to upload (asset version ${version})`);

const groups = new Map();
for (const f of todo) {
  const ext = f.key.split(".").pop().toLowerCase();
  const ct = CONTENT_TYPES[ext] ?? "application/octet-stream";
  // the index changes with every asset change and is fetched fresh, so it is cached briefly
  const cc = f === index ? "public, max-age=300" : CACHE;
  const k = `${ct}|${cc}`;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(f);
}

const tmp = mkdtempSync(join(tmpdir(), "r2-"));
let failed = false;
// small batches with retries: one flaky request only re-sends its batch, and every finished batch is remembered
const BATCH = 25, TRIES = 3;
for (const [k, list] of groups) {
  const [ct, cc] = k.split("|");
  console.log(`  ${list.length} × ${ct}`);
  for (let i = 0; i < list.length; i += BATCH) {
    const part = list.slice(i, i + BATCH);
    const file = join(tmp, "list.json");
    writeFileSync(file, JSON.stringify(part.map((f) => ({ key: f.key, file: resolve(f.path) }))));
    let ok = false;
    for (let t = 1; t <= TRIES && !ok; t++) {
      const r = spawnSync(`npx --yes wrangler@4 r2 bulk put ${R2_BUCKET} --remote --force --concurrency 6 --filename "${file}" --content-type "${ct}" --cache-control "${cc}"`,
        { stdio: "inherit", shell: true });
      ok = r.status === 0;
      if (!ok && t < TRIES) console.error(`  batch ${i / BATCH + 1} failed, retrying (${t + 1}/${TRIES})`);
    }
    if (!ok) { failed = true; console.error(`  upload failed for ${ct} (batch ${i / BATCH + 1})`); continue; }
    for (const f of part) sent[f.key] = f.md5;
    writeFileSync(STATE, JSON.stringify(sent, null, 0));
  }
}
rmSync(tmp, { recursive: true, force: true });
if (failed) process.exit(1);
console.log("R2 upload done");
