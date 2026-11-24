"use client";
// The one player page every game shares: /play?g=<slug> (plus &mode=easy|medium|hard, &embed=1 inside a game page's
// frame). One page for all games keeps the site to one file per game (see AGENTS.md, "Hosting budget"). The game's
// details come from /games/<slug>/game.json (R2), not from the site's code, so this page doesn't grow with every game.
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GamePlayer } from "@/components/player/GamePlayer";
import { GameView } from "@/components/player/GameView";
import { SLUG_ALIASES, type PlayerGame } from "@/lib/game-index";
import { loadGame } from "@/lib/catalog-data";
import type { Difficulty } from "@/lib/store";
import { useLibrary } from "@/lib/library";
import { track } from "@/lib/analytics";

type Loaded = { slug: string; game: PlayerGame | null; failed?: boolean };

export function PlayClient() {
  const sp = useSearchParams();
  const slug = sp.get("g") ?? "";
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

  // the game's own data (usually already fetched by the game page while the player looked at it)
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (alias) return;
    let live = true;
    loadGame(slug).then(
      (game) => { if (live) setLoaded({ slug, game }); },
      () => { if (live) setLoaded({ slug, game: null, failed: true }); },
    );
    return () => { live = false; };
  }, [slug, alias, attempt]);
  const current = loaded?.slug === slug ? loaded : null;
  const g = current?.game ?? null;
  const live = g?.status === "live";

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

  if (alias || !current) return <div className="fixed inset-0 bg-night" />;
  if (current.failed) {
    return (
      <div className="fixed inset-0 grid place-items-center bg-night p-6 text-center">
        <div>
          <p className="font-display text-3xl">Couldn&apos;t load the game</p>
          <p className="mt-2 text-muted">Check your connection and try again.</p>
          <button onClick={() => { setLoaded(null); setAttempt((n) => n + 1); }} className="btn-clay mt-6 inline-flex">Try again</button>
        </div>
      </div>
    );
  }
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
      <GameView game={g} mode={mode} />
    </GamePlayer>
  );
}
