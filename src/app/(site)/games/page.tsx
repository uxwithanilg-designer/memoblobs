import type { Metadata } from "next";
import { Suspense } from "react";
import { Gamepad2 } from "lucide-react";
import { GamesBrowser } from "@/components/games/GamesBrowser";
import { GameGrid } from "@/components/home/GameRow";
import { ListHeader } from "@/components/ui/ListHeader";
import { ALL_PLAYABLE } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "All Games — Play Free Online Games",
  description: `Browse all ${ALL_PLAYABLE.length} MOMOBLOBS games: 3D runners, racing, action, brain, memory, puzzle and speed games. Free to play in your browser, no download.`,
  alternates: { canonical: "/games" },
};

export default function GamesPage() {
  return (
    <div className="page">
      <ListHeader title="All games" icon={<Gamepad2 className="size-6" />} count={ALL_PLAYABLE.length} blurb="Search, sort and filter every game." />
      <Suspense fallback={<GameGrid games={ALL_PLAYABLE} />}>
        <GamesBrowser />
      </Suspense>
    </div>
  );
}
