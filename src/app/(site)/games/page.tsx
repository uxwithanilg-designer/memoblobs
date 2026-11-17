import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHero } from "@/components/ui/PageHero";
import { GamesBrowser } from "@/components/games/GamesBrowser";
import { GameCard } from "@/components/ui/GameCard";
import { GAMES } from "@/lib/games";

export const metadata: Metadata = {
  title: "All Games — Free Kids Brain Games Online",
  description: "Browse every MOMOBLOBS game: free claymation brain, focus, memory and speed games for kids. 31 free games with unlimited levels — Momo Shuffle, Fish Watch, Memory Bridge, Turbo Dash, Maze Munch and more.",
  alternates: { canonical: "/games" },
};

export default function GamesPage() {
  return (
    <>
      <PageHero
        kicker="Arcade"
        title="All games"
        crumbs={[{ name: "Games", href: "/games" }]}
        intro="Clay brain games for sharp eyes. Pick a game, choose a level and start collecting coins!"
        art={{ src: "/brand/kranky.webp", w: 820, h: 520 }}
      />
      <section className="mx-auto max-w-7xl px-5 lg:px-6">
        <Suspense fallback={<div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">{GAMES.map((g) => <GameCard key={g.slug} g={g} />)}</div>}>
          <GamesBrowser />
        </Suspense>
      </section>
    </>
  );
}
