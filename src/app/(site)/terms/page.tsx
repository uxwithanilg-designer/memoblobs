import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The simple terms for playing MOMOBLOBS games: free personal use, be kind, and the Momo, Kranky and Tiki characters belong to MOMOBLOBS.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <>
      <PageHero kicker="The simple rules" title="Terms of use" crumbs={[{ name: "Terms", href: "/terms" }]} intro="Last updated 16 November 2026." />
      <article className="prose-kid mx-auto max-w-3xl px-5 lg:px-6">
        <h2>Playing</h2>
        <p>MOMOBLOBS games are free for personal, family and classroom use in a web browser. Please don&apos;t copy, resell or re-host the games.</p>
        <h2>Coins and items</h2>
        <p>Coins, trophies and cup skins are virtual, have no money value and can&apos;t be bought, sold or exchanged. They live on your device and may be lost if browser data is cleared.</p>
        <h2>Characters and artwork</h2>
        <p>Momo, Kranky, Tiki, the MOMOBLOBS name and logo, the clay artwork, music and sound effects belong to MOMOBLOBS.</p>
        <h2>Availability</h2>
        <p>We work hard to keep the site running smoothly but games are provided “as is” and may change, improve or occasionally be unavailable.</p>
        <h2>Grown-ups</h2>
        <p>If a child is using the site, a parent, guardian or teacher is responsible for supervising their use and any links they follow to other websites.</p>
      </article>
    </>
  );
}
