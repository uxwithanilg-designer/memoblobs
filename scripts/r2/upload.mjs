// Uploads the game files (public/audio, games, brand, fonts) to the R2 bucket. Only new or changed files go up: the
// list of what the bucket holds (each file's fingerprint, its git blob hash) lives in the bucket itself
// (_meta/uploaded.json), so any machine — this PC, another one, GitHub Actions — sends only what changed. GitHub
// Actions doesn't even download the unchanged game files (scripts/r2/asset-index.mjs reads their fingerprints from
// git). .r2-uploaded.json is a local copy, used when the bucket's list can't be read. `--all` sends everything again.
// usage: npm run upload:r2 [-- --all]
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { CONTENT_TYPES, R2_BUCKET } from "./config.mjs";
import { listAssets, writeIndex } from "./asset-index.mjs";
import { REMOTE_LIST, readRemoteList } from "./remote-list.mjs";
// uploads go to the MOMOBLOBS Cloudflare account only (the account_id in wrangler.jsonc), whatever else is logged in
const ACCOUNT = /"account_id":\s*"([0-9a-f]{32})"/.exec(readFileSync("wrangler.jsonc", "utf8"))?.[1];
const WENV = { ...process.env, ...(ACCOUNT ? { CLOUDFLARE_ACCOUNT_ID: ACCOUNT } : {}) };

const STATE = ".r2-uploaded.json";
/** URLs carry ?v=<the bundle's version>, so browsers may keep each file for a year */
const CACHE = "public, max-age=31536000, immutable";

// each game's game.json and the browser's games list are made from src/lib/games.ts first (game.json goes up here)
const gen = spawnSync("node scripts/gen-game-index.mjs", { stdio: "inherit", shell: true });
if (gen.status !== 0) process.exit(gen.status ?? 1);

const all0 = process.argv.includes("--all");
const remote = all0 ? null : await readRemoteList();
const local = !all0 && existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
// GitHub Actions has no local copy of the list and no game files on disk: without the bucket's list it would download
// and re-send every game file, so it stops instead (the next run tries again)
if (!remote && !all0 && process.env.CI && !existsSync(STATE)) {
  console.error("R2 upload: can't read the bucket's list (_meta/uploaded.json) — stopping rather than re-sending every game file");
  process.exit(1);
}
/** key → "<git blob hash>:<size>" for every file in the bucket */
const sent = remote ?? local;
const { version, files: all } = writeIndex(listAssets(sent));
const entry = (f) => `${f.sha}:${f.size}`;
console.log(`R2 upload list: ${remote ? `from the bucket (${Object.keys(remote).length} files)` : all0 ? "sending everything (--all)" : `from this machine (${Object.keys(local).length} files)`}`);

// lists written before fingerprints were git hashes hold md5 sums: a file whose md5 still matches is already there
let adopted = 0;
for (const f of all) {
  const was = sent[f.key];
  if (!was) continue;
  const [sha, size] = String(was).split(":");
  if (sha === f.sha) { if (!size) { sent[f.key] = entry(f); adopted++; } continue; }
  if (/^[0-9a-f]{32}$/.test(sha) && f.path && createHash("md5").update(readFileSync(f.path)).digest("hex") === sha) { sent[f.key] = entry(f); adopted++; }
}
if (adopted) console.log(`R2 upload list: ${adopted} files already in the bucket (fingerprints updated, nothing re-sent)`);

const todo = all.filter((f) => String(sent[f.key] ?? "").split(":")[0] !== f.sha);
console.log(`R2 ${R2_BUCKET}: ${all.length} files, ${todo.length} to upload (asset version ${version})`);

const groups = new Map();
for (const f of todo) {
  const ext = f.key.split(".").pop().toLowerCase();
  const ct = CONTENT_TYPES[ext] ?? "application/octet-stream";
  if (!groups.has(ct)) groups.set(ct, []);
  groups.get(ct).push(f);
}

const tmp = mkdtempSync(join(tmpdir(), "r2-"));
/** a file that's only in git (GitHub Actions doesn't check game files out): written from git to a temporary file */
let fromGit = 0;
function source(f) {
  if (f.path) return resolve(f.path);
  const out = join(tmp, `git-${++fromGit}`);
  const r = spawnSync("git", ["cat-file", "blob", f.sha], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`can't read ${f.key} from git (${f.sha})`);
  writeFileSync(out, r.stdout);
  return out;
}

let failed = false;
// small batches with retries: one flaky request only re-sends its batch, and every finished batch is remembered
const BATCH = 25, TRIES = 3;
for (const [ct, list] of groups) {
  console.log(`  ${list.length} × ${ct}`);
  for (let i = 0; i < list.length; i += BATCH) {
    const part = list.slice(i, i + BATCH);
    const file = join(tmp, "list.json");
    writeFileSync(file, JSON.stringify(part.map((f) => ({ key: f.key, file: source(f) }))));
    let ok = false;
    for (let t = 1; t <= TRIES && !ok; t++) {
      const r = spawnSync(`npx --yes wrangler@4 r2 bulk put ${R2_BUCKET} --remote --force --concurrency 6 --filename "${file}" --content-type "${ct}" --cache-control "${CACHE}"`,
        { stdio: "inherit", shell: true, env: WENV });
      ok = r.status === 0;
      if (!ok && t < TRIES) console.error(`  batch ${i / BATCH + 1} failed, retrying (${t + 1}/${TRIES})`);
    }
    if (!ok) { failed = true; console.error(`  upload failed for ${ct} (batch ${i / BATCH + 1})`); continue; }
    for (const f of part) sent[f.key] = entry(f);
    writeFileSync(STATE, JSON.stringify(sent, null, 0));
  }
}
// the bucket's list, updated (also after a partial failure: what did go up is recorded)
if (todo.length || adopted || !remote) {
  writeFileSync(STATE, JSON.stringify(sent, null, 0));
  const listFile = join(tmp, "uploaded.json");
  writeFileSync(listFile, JSON.stringify(sent));
  const r = spawnSync(`npx --yes wrangler@4 r2 object put ${R2_BUCKET}/${REMOTE_LIST} --remote --file "${listFile}" --content-type application/json --cache-control no-store`,
    { stdio: "inherit", shell: true, env: WENV });
  if (r.status !== 0) console.error("  couldn't save the upload list to the bucket (the next upload falls back to this machine's copy)");
}
rmSync(tmp, { recursive: true, force: true });
if (failed) process.exit(1);
console.log("R2 upload done");
