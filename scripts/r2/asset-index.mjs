// Hashes every game file and writes public/audio/index.json (the sound list the games prefetch from in the
// background). The combined hash is the asset version: it goes on every R2 URL (?v=…), so browsers can keep the
// files forever and still pick up a changed sound or picture after a deploy.
// usage: node scripts/r2/asset-index.mjs   (also run by build:static and upload:r2)
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { ASSET_DIRS } from "./config.mjs";

const PUBLIC = "public";
const INDEX = join(PUBLIC, "audio", "index.json");

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** every file under the asset folders: { key: "audio/arcade/x.mp3", path, size, md5 } */
export function listAssets() {
  return ASSET_DIRS.flatMap((d) => walk(join(PUBLIC, d)))
    .filter((p) => p !== INDEX && !p.endsWith(".DS_Store"))
    .map((p) => {
      const buf = readFileSync(p);
      return { key: relative(PUBLIC, p).split(sep).join("/"), path: p, size: buf.length, md5: createHash("md5").update(buf).digest("hex") };
    })
    .sort((a, b) => (a.key < b.key ? -1 : 1));
}

export function writeIndex(files = listAssets()) {
  const version = createHash("sha1").update(files.map((f) => `${f.key}:${f.md5}`).join("\n")).digest("hex").slice(0, 10);
  const audio = Object.fromEntries(files.filter((f) => f.key.startsWith("audio/") && f.key.endsWith(".mp3")).map((f) => [f.key.slice(6), f.size]));
  const json = JSON.stringify({ v: version, audio });
  let old = "";
  try { old = readFileSync(INDEX, "utf8"); } catch { /* first run */ }
  if (old !== json) writeFileSync(INDEX, json);
  return { version, files };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { version, files } = writeIndex();
  console.log(`asset index: ${files.length} files, version ${version}`);
}
