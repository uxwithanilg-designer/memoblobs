import type { MetadataRoute } from "next";
import { abs, SITE } from "@/lib/site";

/** built once into a static file (the whole site is prerendered; Cloudflare serves it as files) */
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/play/", "/profile", "/settings"] },
      // AI answer engines may read and cite the public pages (GEO / AI search visibility)
      { userAgent: ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "Applebot-Extended"], allow: "/", disallow: ["/play/"] },
    ],
    sitemap: abs("/sitemap.xml"),
    host: SITE.url,
  };
}
