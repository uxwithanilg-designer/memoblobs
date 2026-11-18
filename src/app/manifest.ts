import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { playHref } from "@/lib/catalog";

/** built once into a static file (the whole site is prerendered; Cloudflare serves it as files) */
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MOMOBLOBS — Clay games for sharp eyes",
    short_name: "Momoblobs",
    description: SITE.description,
    id: "/",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["fullscreen", "standalone"],
    orientation: "any",
    background_color: "#160c33",
    theme_color: "#160c33",
    categories: ["games", "entertainment"],
    lang: "en",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Play Momo Shuffle", short_name: "Play", url: playHref("momo-shuffle"), icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Rewards", url: "/rewards" },
    ],
  };
}
