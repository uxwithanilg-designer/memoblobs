import type { Metadata } from "next";
import { LibraryList } from "@/components/games/LibraryList";
import { TOP_PICKS } from "@/lib/lists";

export const metadata: Metadata = { title: "Recently Played", robots: { index: false, follow: true } };

export default function RecentPage() {
  return <div className="page"><LibraryList kind="recent" topPicks={TOP_PICKS} /></div>;
}
