import type { MetadataRoute } from "next";
import { GAMES } from "@/lib/games";
import { abs } from "@/lib/site";

const UPDATED = new Date("2026-11-16");

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/", priority: 1, freq: "weekly" },
    { path: "/games", priority: 0.9, freq: "weekly" },
    { path: "/characters", priority: 0.7, freq: "monthly" },
    { path: "/rewards", priority: 0.6, freq: "monthly" },
    { path: "/parents", priority: 0.7, freq: "monthly" },
    { path: "/help", priority: 0.6, freq: "monthly" },
    { path: "/about", priority: 0.5, freq: "monthly" },
    { path: "/privacy", priority: 0.3, freq: "yearly" },
    { path: "/terms", priority: 0.3, freq: "yearly" },
  ];
  return [
    ...pages.map((p) => ({ url: abs(p.path), lastModified: UPDATED, changeFrequency: p.freq, priority: p.priority })),
    ...GAMES.filter((g) => g.status === "live").map((g) => ({
      url: abs(`/games/${g.slug}`),
      lastModified: UPDATED,
      changeFrequency: "weekly" as const,
      priority: 0.95,
      images: [abs(g.hero), ...g.shots.map(abs)],
    })),
  ];
}
