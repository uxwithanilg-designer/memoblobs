import type { Metadata } from "next";
import { LibraryList } from "@/components/games/LibraryList";

export const metadata: Metadata = { title: "Saved Games", robots: { index: false, follow: true } };

export default function SavedPage() {
  return <div className="page"><LibraryList kind="saved" /></div>;
}
