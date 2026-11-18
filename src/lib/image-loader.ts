// next/image loader for the static (Cloudflare) build: pictures come straight from the R2 bucket, already sized
// and compressed as .webp, so every width uses the same file.
import { cdn } from "./cdn";

export default function r2Loader({ src }: { src: string; width: number; quality?: number }) {
  return cdn(src);
}
