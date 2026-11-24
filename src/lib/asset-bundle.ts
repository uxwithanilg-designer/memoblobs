// Which version a game file's URL carries (?v=…). Files are grouped into bundles that change together — each game's
// folder, each sound family, brand and font folders — and bundles into a fixed number of buckets, each with its own
// version. A changed or added game only changes its own bucket's version, so players don't download every other
// game's sounds and pictures again; and the table of versions in the site's code stays the same size (BUCKETS × 6
// characters) with 60 games or 6,000. Used by cdn() in the browser and by scripts/r2/asset-index.mjs (which works the
// versions out at build time) — one function for both, so they always agree.

/** how many versions the site's code carries */
export const BUCKETS = 256;
/** characters per version in the table */
export const VERSION_CHARS = 6;

/** "games/momo-dash/hero.webp" → "g/momo-dash"; "audio/arcade/sfx_dash_jump.mp3" → "a/dash"; keys have no leading slash */
export function bundleOf(key: string): string {
  const p = key.startsWith("/") ? key.slice(1) : key;
  const parts = p.split("/");
  if (parts[0] === "games" && parts.length > 2) return `g/${parts[1]}`;
  if (parts[0] === "audio") {
    // sounds: audio/arcade/{sfx,music,voice}_<family>_<name>.mp3 and the family's list audio/families/<family>.json
    const m = /^(?:sfx|music|voice)_([a-z0-9]+)_/.exec(parts[2] ?? "");
    if (parts[1] === "arcade" && m) return `a/${m[1]}`;
    if (parts[1] === "families" && parts[2]) return `a/${parts[2].replace(/\.json$/, "")}`;
    return "a/_";
  }
  // brand/chars/…, brand/logo.webp, fonts/…: by sub-folder
  return parts.length > 2 ? `${parts[0]}/${parts[1]}` : parts[0];
}

/** the bucket (0 … BUCKETS-1) a file's bundle falls in */
export function bucketOf(key: string): number {
  const b = bundleOf(key);
  let h = 0x811c9dc5;
  for (let i = 0; i < b.length; i++) h = Math.imul(h ^ b.charCodeAt(i), 0x01000193);
  return (h >>> 0) % BUCKETS;
}
