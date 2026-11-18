// Where the game files live in production. Every game's sounds, music, art and fonts are uploaded to this R2 bucket
// (`npm run upload:r2`) and the static build points the site at ASSET_BASE. Moving to a custom domain later
// (e.g. https://assets.momoblobs.com) is a change to ASSET_BASE only.
export const R2_BUCKET = "momoblobs-assets";
export const ASSET_BASE = process.env.ASSET_BASE ?? "https://pub-a4f2bb911cad471fb3f90544910753a7.r2.dev";
/** public/ folders that go to R2. The site deploy leaves them out (scripts/build-static.mjs): R2 is their only home */
export const ASSET_DIRS = ["audio", "games", "brand", "fonts"];
export const CONTENT_TYPES = {
  mp3: "audio/mpeg", webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml",
  json: "application/json", woff2: "font/woff2", ttf: "font/ttf", gif: "image/gif", mp4: "video/mp4", webm: "video/webm",
};
