// next/image loader for the static (Cloudflare) build: pictures come straight from the R2 bucket, already sized and
// compressed as .webp. A game's big pictures (cover / hero / thumb / poster) also have a 640-px-wide "-sm" copy
// (scripts/gen-small-art.mjs): wherever the picture is shown that small — cards, rows, search, the poster — the browser
// takes the 640w entry of the srcset and gets the small copy, about a fifth of the bytes.
import { cdn } from "./cdn";

/** the pictures that have a small copy (keep in step with BIG in scripts/gen-small-art.mjs) */
const SMALL = /^\/games\/[^/]+\/(cover|hero|thumb|poster)\.webp$/;
/** next.config.ts → images.imageSizes */
const SMALL_WIDTH = 640;

export default function r2Loader({ src, width }: { src: string; width: number; quality?: number }) {
  return cdn(width <= SMALL_WIDTH && SMALL.test(src) ? src.replace(/\.webp$/, "-sm.webp") : src);
}
