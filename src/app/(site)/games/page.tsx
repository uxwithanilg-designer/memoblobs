import type { Metadata } from "next";
import { Suspense } from "react";
import { Gamepad2 } from "lucide-react";
import { GamesBrowser } from "@/components/games/GamesBrowser";
import { GameGrid } from "@/components/home/GameRow";
import { ListHeader } from "@/components/ui/ListHeader";
import { PAGE_SIZE } from "@/lib/catalog";
import { ALL_PLAYABLE } from "@/lib/lists";

export const metadata: Metadata = {
  title: "All Games — Play Free Online Games",
  description: `Browse all ${ALL_PLAYABLE.length} MOMOBLOBS games: 3D runners, racing, action, brain, memory, puzzle and speed games. Free to play in your browser, no download.`,
  alternates: { canonical: "/games" },
};

export default function GamesPage() {
  const firstPage = ALL_PLAYABLE.slice(0, PAGE_SIZE);
  return (
    <div className="page">
      <ListHeader title="All games" icon={<Gamepad2 className="size-6" />} count={ALL_PLAYABLE.length} blurb="Search, sort and filter every game." />
      <Suspense fallback={<GameGrid games={firstPage} />}>
        <GamesBrowser firstPage={firstPage} total={ALL_PLAYABLE.length} />
      </Suspense>
    </div>
  );
}
