import type { Metadata } from "next";
import Link from "next/link";
import { Box, Clock, Flame, LayoutGrid, Sparkles, Bookmark } from "lucide-react";
import { ListHeader } from "@/components/ui/ListHeader";
import { CategoryTiles } from "@/components/home/CategoryTiles";

export const metadata: Metadata = { title: "Game Categories", description: "Browse MOMOBLOBS games by category: action, adventure, racing, shooting, brain, puzzle, memory, focus, speed and number games.", alternates: { canonical: "/categories" } };

const LISTS = [
  { href: "/top", label: "Top picks", icon: Flame, color: "#FF8A3D" },
  { href: "/new", label: "New games", icon: Sparkles, color: "#7FF0E6" },
  { href: "/c/3d", label: "3D games", icon: Box, color: "#9FB8FF" },
  { href: "/recent", label: "Recently played", icon: Clock, color: "#B9AEDB" },
  { href: "/saved", label: "Saved", icon: Bookmark, color: "#FF6F91" },
];

export default function CategoriesPage() {
  return (
    <div className="page">
      <ListHeader title="Explore" icon={<LayoutGrid className="size-6" />} blurb="Every category in one place." />
      <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
        {LISTS.map((l) => (
          <Link key={l.href} href={l.href} className="flex shrink-0 items-center gap-2 rounded-full bg-white/[0.07] px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/[0.06] hover:bg-white/[0.12]">
            <l.icon className="size-4" style={{ color: l.color }} /> {l.label}
          </Link>
        ))}
      </div>
      <CategoryTiles />
    </div>
  );
}
