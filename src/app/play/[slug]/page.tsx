import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getGame, LIVE_GAMES } from "@/lib/games";
import { PlayClient } from "./PlayClient";

export function generateStaticParams() {
  return LIVE_GAMES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps<"/play/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const g = getGame(slug);
  if (!g) return {};
  return {
    title: `Play ${g.title} — free online`,
    description: `Play ${g.title} free in your browser. ${g.tagline}`,
    alternates: { canonical: `/games/${g.slug}` },
    robots: { index: false, follow: true },
    openGraph: { images: [{ url: `/games/${g.slug}/og.jpg`, width: 1200, height: 630 }] },
  };
}

async function Player({ params }: { params: PageProps<"/play/[slug]">["params"] }) {
  const { slug } = await params;
  const g = getGame(slug);
  if (!g || g.status !== "live") notFound();
  return <PlayClient slug={g.slug} />;
}

export default function PlayPage({ params }: PageProps<"/play/[slug]">) {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-night" />}>
      <Player params={params} />
    </Suspense>
  );
}
