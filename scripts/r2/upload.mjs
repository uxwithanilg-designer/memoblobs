// Uploads the game files (public/audio, games, brand, fonts) to the R2 bucket. Only new or changed files go up: the
// list of what the bucket holds (each file's fingerprint) lives in the bucket itself (_meta/uploaded.json), so any
// machine — this PC, another one, GitHub Actions — sends only what changed. .r2-uploaded.json is a local copy, used
// when the bucket's list can't be read. `--all` sends everything again.
// usage: npm run upload:r2 [-- --all]
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ASSET_BASE, CONTENT_TYPES, R2_BUCKET } from "./config.mjs";
// uploads go to the MOMOBLOBS Cloudflare account only (the account_id in wrangler.jsonc), whatever else is logged in
const ACCOUNT = /"account_id":\s*"([0-9a-f]{32})"/.exec(readFileSync("wrangler.jsonc", "utf8"))?.[1];
const WENV = { ...process.env, ...(ACCOUNT ? { CLOUDFLARE_ACCOUNT_ID: ACCOUNT } : {}) };
import { writeIndex } from "./asset-index.mjs";

const STATE = ".r2-uploaded.json";
/** the bucket's own list of what it holds */
const REMOTE_STATE = "_meta/uploaded.json";

// the light games list and each game's about.json are made from src/lib/games.ts first (they go up with the rest)
spawnSync("node scripts/gen-game-index.mjs", { stdio: "inherit", shell: true });
/** URLs carry ?v=<asset version>, so browsers may keep each file for a year */
const CACHE = "public, max-age=31536000, immutable";

const { version, files } = writeIndex();
const index = { key: "audio/index.json", path: join("public", "audio", "index.json"), md5: `index-${version}` };
const all = [...files, index];
async function remoteState() {
  try {
    const r = await fetch(`${ASSET_BASE}/${REMOTE_STATE}?t=${Date.now()}`, { cache: "no-store" });
    if (r.ok) return await r.json();
  } catch { /* offline or not there yet */ }
  return null;
}
const all0 = process.argv.includes("--all");
const remote = all0 ? null : await remoteState();
const local = !all0 && existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
const sent = remote ?? local;
console.log(`R2 upload list: ${remote ? `from the bucket (${Object.keys(remote).length} files)` : all0 ? "sending everything (--all)" : `from this machine (${Object.keys(local).length} files)`}`);
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
        { stdio: "inherit", shell: true, env: WENV });
      ok = r.status === 0;
      if (!ok && t < TRIES) console.error(`  batch ${i / BATCH + 1} failed, retrying (${t + 1}/${TRIES})`);
    }
    if (!ok) { failed = true; console.error(`  upload failed for ${ct} (batch ${i / BATCH + 1})`); continue; }
    for (const f of part) sent[f.key] = f.md5;
    writeFileSync(STATE, JSON.stringify(sent, null, 0));
  }
}
// the bucket's list, updated (also after a partial failure: what did go up is recorded)
if (todo.length || !remote) {
  const listFile = join(tmp, "uploaded.json");
  writeFileSync(listFile, JSON.stringify(sent));
  const r = spawnSync(`npx --yes wrangler@4 r2 object put ${R2_BUCKET}/${REMOTE_STATE} --remote --file "${listFile}" --content-type application/json --cache-control no-store`,
    { stdio: "inherit", shell: true, env: WENV });
  if (r.status !== 0) console.error("  couldn't save the upload list to the bucket (the next upload falls back to this machine's copy)");
}
rmSync(tmp, { recursive: true, force: true });
if (failed) process.exit(1);
console.log("R2 upload done");
