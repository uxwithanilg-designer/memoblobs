"use client";
// The one player page every game shares: /play?g=<slug> (plus &mode=easy|medium|hard, &embed=1 inside a game page's
// frame). One page for all games keeps each game to its own page on the site (see AGENTS.md, "6–9 files per game").
import Link from "next/link";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GamePlayer } from "@/components/player/GamePlayer";
import { GameView } from "@/components/player/GameView";
import { SLUG_ALIASES, getGame } from "@/lib/games";
import type { Difficulty } from "@/lib/store";
import { useLibrary } from "@/lib/library";
import { track } from "@/lib/analytics";

export function PlayClient() {
  const sp = useSearchParams();
  const slug = sp.get("g") ?? "";
  const g = getGame(slug);
  const live = g?.status === "live";
  const m = sp.get("mode");
  const mode = m === "easy" || m === "medium" || m === "hard" ? (m as Difficulty) : undefined;
  const embed = sp.get("embed") === "1";
  // a renamed game's old link moves to the new slug (keeping mode / embed)
  const router = useRouter();
  const alias = SLUG_ALIASES[slug];
  useEffect(() => {
    if (!alias) return;
    const q = new URLSearchParams(sp.toString()); q.set("g", alias);
    router.replace(`/play?${q.toString()}`);
  }, [alias, sp, router]);
  useEffect(() => {
    if (!live || !g) return;
    useLibrary.getState().touch(slug);
    track("play_game", { game_slug: slug, game_title: g.title, game_category: g.category, embedded: embed });
    // the shared page's own title is generic; name the game (again a moment later: Next can set the page's
    // metadata title after this runs on a fresh load)
    const title = `Play ${g.title} — free online | MOMOBLOBS`;
    document.title = title;
    const t = setTimeout(() => { document.title = title; }, 600);
    return () => clearTimeout(t);
  }, [live, g, slug, embed]);

  if (alias) return <div className="fixed inset-0 bg-night" />;
  if (!g || !live) {
    return (
      <div className="fixed inset-0 grid place-items-center bg-night p-6 text-center">
        <div>
          <p className="font-display text-3xl">Game not found</p>
          <p className="mt-2 text-muted">This game isn&apos;t here (yet). Pick another one!</p>
          <Link href="/games" className="btn-clay mt-6 inline-flex">All games</Link>
        </div>
      </div>
    );
  }
  // in the game page's frame, "Quit game" hands control back to the page
  const exit = () => window.parent.postMessage({ type: "momoblobs:exit", slug }, window.location.origin);
  return (
    <GamePlayer key={slug} game={g} embedded={embed} onExit={exit}>
      <GameView slug={slug} mode={mode} />
    </GamePlayer>
  );
}
