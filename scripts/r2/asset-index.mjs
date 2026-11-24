// Lists every game file (public/audio, games, brand, fonts) with its fingerprint, writes each sound family's file
// list and works out the version table.
//   - Fingerprint = the file's git blob hash: the same on every machine, and GitHub Actions can read it from git
//     without downloading the file (it checks out the code without the game files; see .github/workflows/deploy.yml).
//     A file that's on disk is hashed from disk (new and changed files count before they're committed).
//   - public/audio/families/<family>.json: every sound file of one family and its size (what a game prefetches from;
//     one small file per family instead of one list of every sound on the site).
//   - Versions (src/lib/asset-bundle.ts): files are grouped into bundles (each game folder, sound family, brand and
//     font folder) and bundles into a fixed number of buckets; each bucket's version goes on its files' R2 URLs
//     (?v=…). Browsers keep the files for a year and still pick up a change, a new game changes only its own buckets,
//     and the version table in the site's code stays the same size however many games there are.
// usage: node scripts/r2/asset-index.mjs   (also run by build:static and upload:r2)
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { ASSET_DIRS } from "./config.mjs";

const PUBLIC = "public";
const FAMILIES = join(PUBLIC, "audio", "families");
/** the older single list of every sound (replaced by the family lists) */
const OLD_INDEX = join(PUBLIC, "audio", "index.json");

/** git's hash of a file's content ("git hash-object") */
export const gitSha = (buf) => createHash("sha1").update(`blob ${buf.length}\0`).update(buf).digest("hex");
const keyOf = (p) => relative(PUBLIC, p).split(sep).join("/");
const skip = (key) => key === "audio/index.json" || key.startsWith("audio/families/") || key.endsWith(".DS_Store");

// bundleOf() from the browser code itself, so the build and the browser always group files the same way
const tmp = mkdtempSync(join(tmpdir(), "asset-bundle-"));
writeFileSync(join(tmp, "b.mjs"), ts.transpileModule(readFileSync("src/lib/asset-bundle.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
const { BUCKETS, VERSION_CHARS, bucketOf, bundleOf } = await import(pathToFileURL(join(tmp, "b.mjs")).href);
rmSync(tmp, { recursive: true, force: true });
export { bucketOf, bundleOf };

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/**
 * Files git has that aren't on disk: { key, sha, size } (none on a normal checkout; every game file in GitHub
 * Actions). Their sizes come from the bucket's upload list (`known`, key → "sha:size") when the file is unchanged —
 * asking git for a size would download the file — and from git only for new or changed files (uploaded anyway).
 */
function inGitOnly(have, known) {
  const r = spawnSync("git", ["ls-tree", "-r", "-z", "HEAD", "--", ...ASSET_DIRS.map((d) => `${PUBLIC}/${d}`)], { encoding: "utf8", maxBuffer: 1 << 28 });
  if (r.status !== 0) return [];
  return r.stdout.split("\0").filter(Boolean).flatMap((entry) => {
    const tab = entry.indexOf("\t");
    const [, type, sha] = entry.slice(0, tab).trim().split(/\s+/);
    const key = entry.slice(tab + 1).slice(PUBLIC.length + 1);
    if (type !== "blob" || have.has(key) || skip(key)) return [];
    const [ksha, ksize] = String(known[key] ?? "").split(":");
    const size = ksha === sha && ksize ? Number(ksize) : Number(spawnSync("git", ["cat-file", "-s", sha], { encoding: "utf8" }).stdout.trim());
    return [{ key, path: null, sha, size }];
  });
}

/**
 * Every game file: { key: "audio/arcade/x.mp3", path (null when it's only in git), size, sha }.
 * `path: null` files are read with `git cat-file blob <sha>` when they need uploading.
 * `known`: the bucket's upload list (scripts/r2/remote-list.mjs), for the sizes of files that aren't on disk.
 */
export function listAssets(known = {}) {
  const onDisk = ASSET_DIRS.flatMap((d) => walk(join(PUBLIC, d)))
    .map((p) => ({ p, key: keyOf(p) }))
    .filter(({ key }) => !skip(key))
    .map(({ p, key }) => {
      const buf = readFileSync(p);
      return { key, path: p, size: buf.length, sha: gitSha(buf) };
    });
  const files = [...onDisk, ...inGitOnly(new Set(onDisk.map((f) => f.key)), known)];
  return files.sort((a, b) => (a.key < b.key ? -1 : 1));
}

/**
 * Writes the sound families' lists; returns every game file (lists included), the version table (one version per
 * bucket, VERSION_CHARS each, joined: what cdn() reads), the number of bundles and the overall version.
 */
export function writeIndex(base) {
  // each family's sounds with their sizes (keys as the audio code uses them: "arcade/sfx_dash_jump.mp3")
  const fams = new Map();
  for (const f of base) {
    if (!f.key.startsWith("audio/arcade/") || !f.key.endsWith(".mp3")) continue;
    const b = bundleOf(f.key);
    if (!b.startsWith("a/") || b === "a/_") continue;
    const name = b.slice(2);
    if (!fams.has(name)) fams.set(name, {});
    fams.get(name)[f.key.slice(6)] = f.size;
  }
  mkdirSync(FAMILIES, { recursive: true });
  const lists = [];
  for (const [name, sizes] of [...fams].sort()) {
    const p = join(FAMILIES, `${name}.json`);
    const json = JSON.stringify(Object.fromEntries(Object.entries(sizes).sort()));
    if (!existsSync(p) || readFileSync(p, "utf8") !== json) writeFileSync(p, json);
    lists.push({ key: keyOf(p), path: p, size: Buffer.byteLength(json), sha: gitSha(Buffer.from(json)) });
  }
  for (const f of readdirSync(FAMILIES)) if (!fams.has(f.replace(/\.json$/, ""))) rmSync(join(FAMILIES, f));
  if (existsSync(OLD_INDEX)) rmSync(OLD_INDEX);

  const files = [...base, ...lists].sort((a, b) => (a.key < b.key ? -1 : 1));
  const buckets = Array.from({ length: BUCKETS }, () => []);
  const bundles = new Set();
  for (const f of files) {
    buckets[bucketOf(f.key)].push(`${f.key}:${f.sha}`);
    bundles.add(bundleOf(f.key));
  }
  const versions = buckets.map((l) => createHash("sha1").update(l.join("\n")).digest("hex").slice(0, VERSION_CHARS)).join("");
  const version = createHash("sha1").update(files.map((f) => `${f.key}:${f.sha}`).join("\n")).digest("hex").slice(0, 10);
  return { version, versions, bundles: bundles.size, files };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { readRemoteList } = await import("./remote-list.mjs");
  const { version, bundles, files } = writeIndex(listAssets((await readRemoteList()) ?? {}));
  console.log(`asset index: ${files.length} files in ${bundles} bundles, version ${version}`);
}
