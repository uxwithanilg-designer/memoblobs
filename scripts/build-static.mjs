// Builds the whole site as static files in out/ (for Cloudflare): `npm run build:static`.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const r = spawnSync("npx next build", { stdio: "inherit", shell: true, env: { ...process.env, STATIC_EXPORT: "1" } });
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
