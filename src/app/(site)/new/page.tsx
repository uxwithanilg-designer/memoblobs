import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { GameGrid } from "@/components/home/GameRow";
import { ListHeader } from "@/components/ui/ListHeader";
import { NEW_GAMES } from "@/lib/catalog";

export const metadata: Metadata = { title: "New Games — Latest Free Online Games", description: "The newest MOMOBLOBS games: 3D runners, racing, action and brain games. Free to play in your browser.", alternates: { canonical: "/new" } };

export default function NewPage() {
  return (
    <div className="page">
      <ListHeader title="New games" icon={<Sparkles className="size-6" />} color="#7FF0E6" count={NEW_GAMES.length} blurb="The latest games, newest first." />
      <GameGrid games={NEW_GAMES} priority />
    </div>
  );
}
