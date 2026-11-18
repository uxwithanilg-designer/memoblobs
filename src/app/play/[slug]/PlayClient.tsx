"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { GamePlayer } from "@/components/player/GamePlayer";
import { GameView } from "@/components/player/GameView";
import { getGame } from "@/lib/games";
import type { Difficulty } from "@/lib/store";
import { useLibrary } from "@/lib/library";

export function PlayClient({ slug }: { slug: string }) {
  const sp = useSearchParams();
  const g = getGame(slug)!;
  const m = sp.get("mode");
  const mode = m === "easy" || m === "medium" || m === "hard" ? (m as Difficulty) : undefined;
  const embed = sp.get("embed") === "1";
  useEffect(() => { useLibrary.getState().touch(slug); }, [slug]);
  // in the game page's frame, "Quit game" hands control back to the page
  const exit = () => window.parent.postMessage({ type: "momoblobs:exit", slug }, window.location.origin);
  return (
    <GamePlayer game={g} embedded={embed} onExit={exit}>
      <GameView slug={slug} mode={mode} />
    </GamePlayer>
  );
}
