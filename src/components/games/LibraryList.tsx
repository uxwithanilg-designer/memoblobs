"use client";
// Recently played and saved games (kept on this device).
import Link from "next/link";
import { Bookmark, Clock } from "lucide-react";
import { GameGrid } from "@/components/home/GameRow";
import { ListHeader } from "@/components/ui/ListHeader";
import type { GameCard } from "@/lib/game-index";
import { cardsOf, useCatalog } from "@/lib/catalog-data";
import { useLibrary } from "@/lib/library";
import { useHydrated } from "@/lib/store";

/** `topPicks`: shown when the list is empty (passed in by the server-built page) */
export function LibraryList({ kind, topPicks }: { kind: "recent" | "saved"; topPicks: GameCard[] }) {
  const hydrated = useHydrated();
  const recent = useLibrary((s) => s.recent);
  const saved = useLibrary((s) => s.saved);
  const slugs = kind === "recent" ? recent.map((r) => r.slug) : saved;
  // the games list is fetched only when this device has games to show
  const catalog = useCatalog(hydrated && slugs.length > 0);
  const ok = hydrated && (slugs.length === 0 || catalog !== null);
  const games = ok && catalog ? cardsOf(catalog, slugs) : [];
  const head = kind === "recent"
    ? <ListHeader title="Recently played" icon={<Clock className="size-6" />} color="#B9AEDB" count={ok ? games.length : undefined} blurb="Jump back in where you left off." />
    : <ListHeader title="Saved games" icon={<Bookmark className="size-6" />} color="#FF6F91" count={ok ? games.length : undefined} blurb="Tap the bookmark under any game to save it here." />;
  return (
    <>
      {head}
      {ok && games.length > 0 && (
        <>
          <GameGrid games={games} />
          {kind === "recent" && <button onClick={() => useLibrary.getState().clearRecent()} className="mt-5 rounded-full bg-white/[0.07] px-4 py-2 text-sm font-semibold text-white/75 hover:bg-white/[0.12] hover:text-white">Clear history</button>}
        </>
      )}
      {ok && games.length === 0 && (
        <div className="rounded-2xl bg-white/[0.04] p-8 text-center ring-1 ring-white/[0.06]">
          <p className="text-lg font-bold text-white">{kind === "recent" ? "No games played yet" : "No saved games yet"}</p>
          <p className="mt-1 text-sm text-muted">{kind === "recent" ? "Games you play show up here." : "Press the bookmark button under a game to keep it here."}</p>
          <Link href="/top" className="mt-4 inline-flex rounded-full bg-sun px-5 py-2.5 font-bold text-ink">Find a game</Link>
        </div>
      )}
      {ok && games.length === 0 && (
        <div className="mt-8">
          <h2 className="mb-2.5 text-lg font-bold text-white">Top picks</h2>
          <GameGrid games={topPicks} />
        </div>
      )}
    </>
  );
}
