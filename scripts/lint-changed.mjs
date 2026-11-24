// Lints only the files that changed (a thousand games' worth of code doesn't need linting on every push).
// Changed = since BASE (an env var: a commit, e.g. the previous push in CI), else since origin/main, plus anything not
// committed yet. Deleted files are skipped.  usage: npm run lint:changed   (BASE=<sha> npm run lint:changed)
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const git = (args) => spawnSync("git", args, { encoding: "utf8" }).stdout ?? "";
const valid = (ref) => !!ref && !/^0+$/.test(ref) && spawnSync("git", ["cat-file", "-e", `${ref}^{commit}`]).status === 0;
const base = valid(process.env.BASE) ? process.env.BASE : valid("origin/main") ? git(["merge-base", "HEAD", "origin/main"]).trim() || "origin/main" : "HEAD~1";
const names = new Set([
  ...git(["diff", "--name-only", "--diff-filter=ACMR", base, "HEAD"]).split("\n"),
  ...git(["diff", "--name-only", "--diff-filter=ACMR", "HEAD"]).split("\n"),
  ...git(["ls-files", "--others", "--exclude-standard"]).split("\n"),
]);
const files = [...names].filter((f) => /\.(ts|tsx|mjs|js)$/.test(f) && !f.startsWith("public/") && existsSync(f));
if (!files.length) { console.log(`lint: nothing changed since ${base.slice(0, 10)}`); process.exit(0); }
console.log(`lint: ${files.length} changed file${files.length === 1 ? "" : "s"} since ${base.slice(0, 10)}`);
const r = spawnSync("npx", ["--no-install", "eslint", ...files], { stdio: "inherit", shell: process.platform === "win32" });
process.exit(r.status ?? 1);
