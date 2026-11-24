import type { MetadataRoute } from "next";
import { CATEGORIES, GAMES } from "@/lib/games";
import { is3D, posterOf } from "@/lib/catalog";
import { inCategory } from "@/lib/lists";
import { seoOf } from "@/lib/seo";
import { abs, absAsset } from "@/lib/site";

/** built once into a static file (the whole site is prerendered; Cloudflare serves it as files) */
export const dynamic = "force-static";

/** the day the site-wide pages (help, about…) last changed for real — bump it when you edit them */
const SITE_PAGES_UPDATED = "2026-11-22";
const LEGAL_UPDATED = "2026-11-16";

const at = (day: string) => new Date(`${day}T00:00:00Z`);
const latest = (days: string[]) => days.reduce((a, b) => (b > a ? b : a), "2026-11-16");

export default function sitemap(): MetadataRoute.Sitemap {
  const live = GAMES.filter((g) => g.status === "live");
  const gameDay = new Map(live.map((g) => [g.slug, seoOf(g).updated]));
  // a list page changes when one of the games on it changes (or a game is added)
  const newestOf = (slugs: string[]) => latest(slugs.map((s) => gameDay.get(s) ?? ""));
  const allGames = newestOf(live.map((g) => g.slug));

  const pages: { path: string; day: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/", day: allGames, priority: 1, freq: "daily" },
    { path: "/games", day: allGames, priority: 0.9, freq: "daily" },
    { path: "/new", day: allGames, priority: 0.8, freq: "daily" },
    { path: "/top", day: allGames, priority: 0.8, freq: "weekly" },
    { path: "/categories", day: allGames, priority: 0.7, freq: "weekly" },
    { path: "/c/3d", day: newestOf(live.filter(is3D).map((g) => g.slug)), priority: 0.8, freq: "weekly" },
    ...CATEGORIES.map((c) => ({ path: `/c/${c.id}`, day: newestOf(inCategory(c.id).map((g) => g.slug)), priority: 0.8, freq: "weekly" as const })),
    { path: "/characters", day: SITE_PAGES_UPDATED, priority: 0.6, freq: "monthly" },
    { path: "/rewards", day: SITE_PAGES_UPDATED, priority: 0.5, freq: "monthly" },
    { path: "/parents", day: SITE_PAGES_UPDATED, priority: 0.6, freq: "monthly" },
    { path: "/help", day: SITE_PAGES_UPDATED, priority: 0.5, freq: "monthly" },
    { path: "/about", day: SITE_PAGES_UPDATED, priority: 0.5, freq: "monthly" },
    { path: "/privacy", day: LEGAL_UPDATED, priority: 0.3, freq: "yearly" },
    { path: "/terms", day: LEGAL_UPDATED, priority: 0.3, freq: "yearly" },
  ];
  return [
    ...pages.map((p) => ({ url: abs(p.path), lastModified: at(p.day), changeFrequency: p.freq, priority: p.priority })),
    ...live.map((g) => ({
      url: abs(`/games/${g.slug}`),
      lastModified: at(gameDay.get(g.slug)!),
      changeFrequency: "weekly" as const,
      priority: 0.9,
      images: [...new Set([g.hero, posterOf(g), `/games/${g.slug}/og.jpg`, ...g.shots])].map(absAsset),
    })),
  ];
}
