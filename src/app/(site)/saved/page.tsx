import type { Metadata } from "next";
import { LibraryList } from "@/components/games/LibraryList";
import { TOP_PICKS } from "@/lib/lists";

export const metadata: Metadata = { title: "Saved Games", robots: { index: false, follow: true } };

export default function SavedPage() {
  return <div className="page"><LibraryList kind="saved" topPicks={TOP_PICKS} /></div>;
}
