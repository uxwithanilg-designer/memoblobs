// Game files (sounds, music, art, fonts) come from the R2 bucket in the Cloudflare build (NEXT_PUBLIC_ASSET_BASE,
// set by scripts/build-static.mjs); `next dev` serves them from public/. Every R2 URL carries the asset version,
// so browsers keep the files for a year and still pick up a changed file after a deploy.

import { VERSION_CHARS, bucketOf } from "./asset-bundle";

const BASE = (process.env.NEXT_PUBLIC_ASSET_BASE ?? "").replace(/\/+$/, "");
const VER = process.env.NEXT_PUBLIC_ASSET_VER ?? "";
/**
 * The version table (src/lib/asset-bundle.ts): one short version per bucket of files, set by
 * scripts/build-static.mjs. A file's URL changes only when its own bucket changes, so adding or fixing one game never
 * makes players download every other game's files again — and the table is the same size with 60 games or 6,000.
 */
const VERS = process.env.NEXT_PUBLIC_ASSET_VERS ?? "";
const MEDIA = /^\/(audio|brand|fonts|games)\/[^?#]+\.[a-z0-9]+$/i;

/** true when game files load from R2 (static build) */
export const REMOTE_ASSETS = BASE !== "";
/** the R2 origin, for preconnect */
export const ASSET_ORIGIN = BASE ? new URL(BASE).origin : "";

/**
 * Inline script for the page: a picture that fails to come from R2 (r2.dev rate limit, a network hiccup) is asked
 * for once more a moment later, so nothing stays broken.
 */
export const IMG_RETRY_JS = BASE
  ? `addEventListener("error",function(e){var t=e.target,b=${JSON.stringify(BASE)};if(!t||t.tagName!=="IMG"||t.dataset.r2)return;` +
    `var s=t.currentSrc||t.src||"";if(s.indexOf(b)!==0)return;t.dataset.r2="1";setTimeout(function(){t.removeAttribute("srcset");` +
    `t.src=s+(s.indexOf("?")<0?"?":"&")+"retry=1"},1500)},true)`
  : "";

/** where to load a game file from: "/brand/x.webp" → R2 URL in production. Page links, data: and full URLs pass through. */
export function cdn(path: string): string {
  if (!BASE || !MEDIA.test(path)) return path;
  const b = bucketOf(path) * VERSION_CHARS;
  const v = VERS.slice(b, b + VERSION_CHARS) || VER;
  return v ? `${BASE}${path}?v=${v}` : BASE + path;
}
