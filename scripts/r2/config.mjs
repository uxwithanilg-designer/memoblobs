// Where the game files live in production. Every game's sounds, music, art and fonts are uploaded to this R2 bucket
// (`npm run upload:r2`) and the static build points the site at ASSET_BASE: the bucket's custom domain
// assets.momoblobs.com (connected 2026-11-22). The old r2.dev address still answers but is rate-limited and uncached.
export const R2_BUCKET = "momoblobs-assets";
export const ASSET_BASE = process.env.ASSET_BASE ?? "https://assets.momoblobs.com";
/** public/ folders that go to R2. The site deploy leaves them out (scripts/build-static.mjs): R2 is their only home */
export const ASSET_DIRS = ["audio", "games", "brand", "fonts"];
export const CONTENT_TYPES = {
  mp3: "audio/mpeg", webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml",
  json: "application/json", woff2: "font/woff2", ttf: "font/ttf", gif: "image/gif", mp4: "video/mp4", webm: "video/webm",
};
