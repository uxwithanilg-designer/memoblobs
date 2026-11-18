import type { Metadata } from "next";
import { Flame } from "lucide-react";
import { GameGrid } from "@/components/home/GameRow";
import { ListHeader } from "@/components/ui/ListHeader";
import { ALL_PLAYABLE } from "@/lib/catalog";

export const metadata: Metadata = { title: "Top Picks — Best Free Online Games", description: "Our best MOMOBLOBS games, hand-picked: Kiko's Jungle Quest, Momo Dash, Nitro Rush, Blob Brigade and more.", alternates: { canonical: "/top" } };

export default function TopPage() {
  return (
    <div className="page">
      <ListHeader title="Top picks" icon={<Flame className="size-6" />} color="#FF8A3D" count={ALL_PLAYABLE.length} blurb="Our best games first." />
      <GameGrid games={ALL_PLAYABLE} priority />
    </div>
  );
}
